/**
 * # Treatment conditions for meritocracy game.
 * Copyright(c) 2014 Stefano Balietti
 * MIT Licensed
 *
 * Contains helper functions to create Gaussian noise.
 *
 * http://www.nodegame.org
 * ---
 */

var J = require('JSUS').JSUS;

var ngc = require('nodegame-client');


// Share through channel.require
var node = module.parent.exports.node;
var treatment = module.parent.exports.treatment;
var settings = module.parent.exports.settings;
var dk = module.parent.exports.dk;
var SUBGROUP_SIZE = module.parent.exports.SUBGROUP_SIZE;

var ENDO = treatment === 'endo';

var treatments = {};
module.exports = treatments;

// High and low stands for "meritocracy", not for noise.
var NOISE_STD = settings.NOISE_STD[treatment];

var GROUP_ACCOUNT_DIVIDER = settings.GROUP_ACCOUNT_DIVIDER;

var groupNames = settings.GROUP_NAMES;

// Number of coins for each player at the beginning of each round
var INITIAL_COINS = settings.INITIAL_COINS;

// Functions used in map-reduce.

function averageContribution(pv, cv) {
    return pv + cv.value.contribution;
}

function averageDemand(pv, cv) {
    return pv + cv.value.demand;
}

function computeGroupAccount(prev, curr) {
    return prev + curr[0];
}

// If two contributions are exactly the same, then they are randomly ordered.
function sortContributions(c1, c2) {
    if (c1.value.contribution > c2.value.contribution) return -1;
    if (c1.value.contribution < c2.value.contribution) return 1;
    if (Math.random() <= 0.5) return -1;
    return 1;
}

// If two demands are exactly the same, then they are randomly ordered.
function sortDemands(c1, c2) {
    if (c1.value.demand > c2.value.demand) return -1;
    if (c1.value.demand < c2.value.demand) return 1;
    if (Math.random() <= 0.5) return -1;
    return 1;
}

// If two contributions are exactly the same, then they are randomly ordered.
function sortNoisyContributions(c1, c2) {
    if (c1.value.noisyContribution > c2.value.noisyContribution) return -1;
    if (c1.value.noisyContribution < c2.value.noisyContribution) return 1;
    if (Math.random() <= 0.5) return -1;
    return 1;
}

/**
 * Returns payoff
 *
 * @param  {array} contributions Array of contribution values by group
 * @param  {array} position     position of current player
 * @param  {object} currentStage current stage
 * @return {int}              payoff
 */
function getPayoff(bars, position) {
    var payoff, group;
    group = bars[position[0]];
    payoff = group.reduce(computeGroupAccount, 0);
    payoff = payoff / GROUP_ACCOUNT_DIVIDER;
    payoff = INITIAL_COINS - group[position[1]][0] + payoff;
    return payoff;
}

/**
 * Splits a sorted array of contributions objects into four groups
 *
 * Computes the ranking, i.e. the list of player ids from top to bottom.
 *
 * @param {array} ranking The sorted array of contribution objects
 * @return {object} Object containing the ranking and groups
 */
function doGroupMatching(sortedContribs) {
    var i, len, groups, entry, ranking, bars;
    var gId, gName;
    len = sortedContribs.length;
    groups = [];
    ranking = [];
    bars = [];
    gId = -1;
    for (i = 0; i < len; i++) {
        if (i % SUBGROUP_SIZE == 0) {
            ++gId;
            groups[gId] = [];
            bars[gId] = [];
        }
        entry = sortedContribs[i];
        entry.group = groupNames[gId];
        groups[gId].push(entry);
        ranking.push(entry.player);
        bars[gId].push([entry.value.contribution, entry.value.demand]);
    }
    return {
        groups: groups,
        ranking: ranking,
        bars: bars
    };
}
// Group Matching for ENDO condition
function endoGroupMatching(sortedContribs) {
    var i, j;
    var bars, ranking, groups, compatibility;
    var noGroup, alreadyTaken, temp;
    var entryI, entryJ, gId;
    var len, limit;

    // Helper variables.
    noGroup = [];
    alreadyTaken = {};

    // Main output.
    groups = [];
    bars = [];
    ranking = [];
    compatibility = [];
    
    gId = -1;
    len = sortedContribs.length;
    limit = len - SUBGROUP_SIZE;

    for (i = 0; i < len; i++) {

        entryI = sortedContribs[i];
        if (alreadyTaken[entryI.player]) continue;

        // Last elements should already had formed a group, if it was possible.
        if (i > limit) {
            noGroup.push(entryI);
            continue;
        }

        // Base object. New entries will be added here, if compatible.
        temp = {
            groups: [entryI],
            ranking: [entryI.player],
            bars: [[entryI.value.contribution, entryI.value.demand]],
            minContrib: entryI.value.contribution,
            maxDemand: entryI.value.demand
        };

        // Check if a group can be made with remaining entries. Entries with
        // higher contributions have been checked already.
        for (j = (i + 1); j < len; j++) {
            // Check this entry.
            entryJ = sortedContribs[j];
            if (alreadyTaken[entryJ.player]) continue;            


            // Since contributions are sorted we don't check further.
            if (entryJ.value.contribution < temp.maxDemand) {          
                noGroup.push(entryI);
                break;
            }
            
            // Entry is compatible.
            if (entryJ.value.demand <= temp.minContrib) {

                // Add entryJ to the current temp group.
                temp.groups.push(entryJ);
                temp.ranking.push(entryJ.player);
                temp.bars.push([entryJ.value.contribution, entryJ.value.demand]);

                // Update requirements for the group.                
                temp.minContrib = Math.min(temp.minContrib, 
                                           entryJ.value.contribution);
                temp.maxDemand = Math.max(temp.maxDemand, entryJ.value.demand);

                // Check if we have enough compatible players in group.
                if (temp.groups.length >= SUBGROUP_SIZE) {
                    // Update group-id counter.
                    ++gId;

                    // Add the group the main output.
                    groups.push(temp.groups);
                    ranking = ranking.concat(temp.ranking);
                    bars.push(temp.bars);
                    compatibility[gId] = 1;
                    
                    // Mark all entries as taken.
                    for (j = 0; j < SUBGROUP_SIZE; j++) {
                        entryJ = temp.groups[j];
                        alreadyTaken[entryJ.player] = entryJ.player;
                        entryJ.group = groupNames[gId];
                    }                
                    break;
                }
                
            }
            
            // We don't have enough players left to try to complete the group.
            else if ((len - (j+1)) < (SUBGROUP_SIZE - temp.groups.length)) {
                // Mark entryI as without group.
                noGroup.push(entryI);
                break;
            }
        }        
    }
    
    if (noGroup.length) {
        // Creating random groups from entries in no group.
        noGroup = J.shuffle(noGroup);        
        for (i = 0; i < noGroup.length; i++) {
            if (i % SUBGROUP_SIZE == 0) {
                ++gId;
                groups[gId] = [];
                bars[gId] = [];
            }
            entryJ = noGroup[i];
            entryJ.group = groupNames[gId];
            groups[gId].push(entryJ);
            ranking.push(entryJ.player);
            bars[gId].push([entryJ.value.contribution, entryJ.value.demand]);
            compatibility[gId] = 0;
        }
    }

    return {
        groups: groups,
        ranking: ranking,
        bars: bars,
        compatibility: compatibility
    };
}


function computeGroupStats(groups) {
    var i, len, group;
    var j, lenJ, entry;
    var out, groupName;

    var cSumSquared, dSumSquared, cSum, dSum, df;
    out = {};
    i = -1, len = groups.length;
    for (; ++i < len;) {
        group = groups[i];
        groupName = groupNames[i];
        j = -1, lenJ = group.length;

        cSum = 0,
        cSumSquared = 0;

        dSum = 0;
        dSumSquared = 0;

        for (; ++j < lenJ;) {
            entry = groups[i][j].value;

            cSum += entry.contribution;
            cSumSquared = Math.pow(entry.contribution, 2);

            if (ENDO) {
                dSum += entry.demand;
                dSumSquared = Math.pow(entry.demand, 2);
            }
        }

        df = lenJ - 1;

        out[groupName] = {
            avgContr: cSum / lenJ,
            stdContr: df <= 1 ? 'NA' : 
                Math.sqrt((cSumSquared - (Math.pow(cSum, 2) / lenJ)) / df)
        };

        if (ENDO) {
            out[groupName].avgDemand = dSum / lenJ;
            out[groupName].stdDemand = df <= 1 ? 'NA' :
                Math.sqrt((dSumSquared - (Math.pow(dSum, 2) / lenJ)) / df);
        }
        else {
            out[groupName].avgDemand = 'NA';
            out[groupName].stdDemand = 'NA';
        }
    }
    return out;
}

/**
 * Create Noise on contribution.
 * @param  {NDDB} receivedData Received data from client
 * @return {NDDB}              Received data, with noise field
 */
function createNoise(receivedData, std) {
    var contrib, noise;
    var i, len;
    i = -1, len = receivedData.db.length;
    console.log('STD ', std);
    for (; ++i < len;) {
        contrib = receivedData.db[i].value.contribution;
        noise = J.nextNormal(0, std);
        receivedData.db[i].value.noisyContribution = contrib + noise;
        console.log(contrib, noise, receivedData.db[i].value.noisyContribution);
    }
    return receivedData;
}

/**
 * Send and saves received values for each player.
 */
function emitPlayersResults(ranking, bars, allPositions, allPayoffs,
                            compatibility) {
    var i, len, finalBars;
    i = -1, len = ranking.length;
    for ( ; ++i < len ; ) {
        finalBars = [bars, allPositions[i], allPayoffs, compatibility];
        node.say('results', ranking[i], finalBars);
    }
}

// Saves the outcome of a round to database, and communicates it to the clients.
function finalizeRound(currentStage, bars,
                       groupStats, groups, ranking, noisyGroupStats,
                       noisyGroups, noisyRanking, compatibility) {

    var i, len, j, lenJ, contribObj;
    var pId, positionInNoisyRank, playerPayoff;
    var allPayoffs, allPositions;
    var code;

    if (settings.DB === 'MONGODB') {
        // Save the results at the group level.
        node.game.saveRoundResults(ranking, groupStats,
                                   noisyRanking, noisyGroupStats);
    }

    console.log(noisyGroups.length);
    console.log('!!!!!');
    
    allPayoffs = [];
    allPositions = [];

    // Save the results for each player, and notify him.
    i = -1, len = noisyGroups.length;
    for (; ++i < len;) {
        j = -1, lenJ = noisyGroups[i].length;
        allPayoffs.push([]);
        
        console.log(noisyGroups[i].length);
        console.log('======');
        
        for (; ++j < lenJ;) {
            contribObj = noisyGroups[i][j];

            // Position in Rank (array of group id, position within group).
            positionInNoisyRank = [i, j];
            allPositions.push(positionInNoisyRank);

            pId = contribObj.player;
            
            playerPayoff = getPayoff(bars, positionInNoisyRank);
            
            allPayoffs[i].push(playerPayoff);            
            
            // Updating the player database with the current payoff.
            code = dk.codes.id.get(pId);
            if (!code) {
                console.log('AAAH code not found: ', pId);                
            }	   
            code.win = !code.win ? playerPayoff : code.win + playerPayoff;
	    console.log('Added to ' + pId + ' ' + playerPayoff + ' ECU');
            // End Update.
            
            if (settings.DB === 'MONGODB') {
                node.game.savePlayerValues(contribObj, playerPayoff,
                                           positionInNoisyRank,
                                           ranking,
                                           noisyRanking,
                                           groupStats,
                                           currentStage);
            }

        }
    }

    // Emit all payoffs.
    emitPlayersResults(noisyRanking, bars, allPositions, allPayoffs,
                       compatibility);
}

// // Removes duplicates in case of reconnections.
// function merge(arr) {    
//    for(var o = {}, i; i=arr.shift(); o[i.player] = i.count + (o[i.player] || 0));
//    for(i in o) arr.push({name:i, count:o[i]});
// }

function sendNoisyResults() {
    var currentStage, previousStage,
    receivedData,
    sortedContribs,
    matching,
    ranking, groups, groupStats,
    noisyRanking, noisyGroups, noisyGroupStats,
    bars;

    currentStage = node.game.getCurrentGameStage();
    previousStage = node.game.plot.previous(currentStage);

    receivedData = node.game.memory.stage[previousStage]
        .selexec('key', '=', 'bid');

    sortedContribs = receivedData
        .sort(sortContributions)
        .fetch();

    // Original Ranking (without noise).
    matching = doGroupMatching(sortedContribs);

    // Array of sorted player ids, from top to lowest contribution.
    ranking = matching.ranking;
    // Array of array of contributions objects.
    groups = matching.groups;
    // Compute average contrib and demand in each group.
    groupStats = computeGroupStats(groups);

    // Add Noise.
    receivedData = createNoise(receivedData, NOISE_STD);

    sortedContribs = receivedData
        .sort(sortNoisyContributions)
        .fetch();

    matching = doGroupMatching(sortedContribs);

    // Array of sorted player ids, from top to lowest contribution.
    noisyRanking = matching.ranking;
    // Array of array of contributions objects.
    noisyGroups = matching.groups;
    // Compute average contrib and demand in each group.
    noisyGroupStats = computeGroupStats(noisyGroups);

    // Bars for display in clients.
    bars = matching.bars;

    // Save to db, and sends results to players.
    finalizeRound(currentStage, bars,
                  groupStats, groups, ranking,
                  noisyGroupStats, noisyGroups, noisyRanking);
}


// STARTING THE TREATMENTS.

// EXO PERFECT.
treatments.exo_perfect = {

    sendResults: function () {
        var currentStage, previousStage,
        receivedData,
        sortedContribs,
        matching,
        ranking, groups, groupStats,
        noisyRanking, noisyGroups, noisyGroupStats,
        bars;

        currentStage = node.game.getCurrentGameStage();
        previousStage = node.game.plot.previous(currentStage);

        receivedData = node.game.memory.stage[previousStage]
            .selexec('key', '=', 'bid');
        
        // If a player submitted twice with reconnections.

        var i, len, o = {}, c, newSize = 0;
        i = -1, len = receivedData.db.length;
        for ( ; ++i < len ; ) {
            c = receivedData.db[i];
            if (!o[c.player]) {
                ++newSize;
            }
            o[c.player] = c;
        }
        if (newSize !== receivedData.length) {
            var newDb = [];
            for ( i in o ) {
                if (o.hasOwnProperty(i)) {
                    newDb.push(o[i]);
                }
            }
            receivedData = new ngc.GameDB();
            receivedData.importDB(newDb);
        }

        // If a player submitted twice with reconnections.

        sortedContribs = receivedData
            .sort(sortContributions)
            .fetch();

        // Original Ranking (without noise).
        matching = doGroupMatching(sortedContribs);

        // Array of sorted player ids, from top to lowest contribution.
        ranking = matching.ranking;
        // Array of array of contributions objects.
        groups = matching.groups;
        // Compute average contrib and demand in each group.
        groupStats = computeGroupStats(groups);

        // Add Noise (not in this case).
        noisyRanking = ranking;
        noisyGroups = groups;
        noisyGroupStats = groupStats;

        // Bars for display in clients.
        bars = matching.bars;

        // Save to db, and sends results to players.
        finalizeRound(currentStage, bars,
                      groupStats, groups, ranking,
                      noisyGroupStats, noisyGroups, noisyRanking);
    }
};


// EXO HIGH.
treatments.exo_high = {
    sendResults: sendNoisyResults   
};

// EXO LOW.
treatments.exo_low = {
    sendResults: sendNoisyResults
};


// EXO LOWLOW.
treatments.exo_lowlow = {
    sendResults: sendNoisyResults
};

// EXO EXTRALOW.
treatments.exo_extralow = {
    sendResults: sendNoisyResults
};

// EXO MINOR.
treatments.exo_minor = {
    sendResults: sendNoisyResults
};

// EXO RANDO.
treatments.random = {
    sendResults: function () {
        var currentStage, previousStage,
        receivedData,
        sortedContribs,
        matching,
        ranking, groups, groupStats,
        noisyRanking, noisyGroups, noisyGroupStats,
        bars;

        currentStage = node.game.getCurrentGameStage();
        previousStage = node.game.plot.previous(currentStage);

        receivedData = node.game.memory.stage[previousStage]
            .selexec('key', '=', 'bid');

        // Shuffle contributions randomly.
        sortedContribs = receivedData
            .shuffle()
            .fetch();

        // Original Ranking (without noise).
        matching = doGroupMatching(sortedContribs);

        // Array of sorted player ids, from top to lowest contribution.
        ranking = matching.ranking;
        // Array of array of contributions objects.
        groups = matching.groups;
        // Compute average contrib and demand in each group.
        groupStats = computeGroupStats(groups);

        // Add Noise (not in this case).
        noisyRanking = ranking;
        noisyGroups = groups;
        noisyGroupStats = groupStats;

        // Bars for display in clients.
        bars = matching.bars;

        // Save to db, and sends results to players.
        finalizeRound(currentStage, bars,
                      groupStats, groups, ranking,
                      noisyGroupStats, noisyGroups, noisyRanking);
    }
};

// EXO ENDO. TODO: Test it with at least 16 players.
treatments.endo = {

    sendResults: function() {
        var currentStage, previousStage,
        receivedData,
        sortedContribs,
        matching,
        ranking, groups, groupStats,
        noisyRanking, noisyGroups, noisyGroupStats,
        bars;

        currentStage = node.game.getCurrentGameStage();
        previousStage = node.game.plot.previous(currentStage);

        receivedData = node.game.memory.stage[previousStage]
            .selexec('key', '=', 'bid');

        if (!receivedData) {
            console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
            return;
            debugger
        }

        sortedContribs = receivedData
            .sort(sortContributions)
            .fetch();

        matching = endoGroupMatching(sortedContribs);

        // Array of sorted player ids, from top to lowest contribution.
        ranking = matching.ranking;
        // Array of array of contributions objects.
        groups = matching.groups;
        // Compute average contrib and demand in each group.
        groupStats = computeGroupStats(groups);

        // Add Noise (not in this case).
        noisyRanking = ranking;
        noisyGroups = groups;
        noisyGroupStats = groupStats;

        // Bars for display in clients.
        bars = matching.bars;

        compatibility = matching.compatibility

        // Save to db, and sends results to players.
        finalizeRound(currentStage, bars,
                      groupStats, groups, ranking,
                      noisyGroupStats, noisyGroups, noisyRanking,
                      compatibility);
    },
};

// BLACKBOX.
treatments.blackbox = treatments.exo_perfect;


// NOT USED AT THE MOMENT


function shuffleArray(o) {
    for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--
                                                                             i], o[i] = o[j], o[j] = x);
    return o;
};

/**
 * Returns position of player in ranking
 * @param  {array} ranking contains players' ids
 * @param  {object} p       player object
 * @return {array}         first group, then position in group
 */
function getPosition(ranking, p) {
    var position = [];
    position[0] = Math.floor(ranking.indexOf(p.id) / 4);
    position[1] = ranking.indexOf(p.id) % 4;
    return position;
}

/**
 * Assigns a group to each player
 * @param {array} ranking  Array of players' ids
 */
function groupMatching(ranking) {
    var iter,
    group,
    person;
    for (iter = 0; iter < ranking.length; iter++) {
        group = Math.floor(iter / 4);
        group = groupNames[group];
        person = node.game.pl.id.update(ranking[iter], {
            group: group
        });
    }
}

/**
 * Returns group averages and values for players in same group.
 * @param  {object} player       player from receivedData
 * @param  {NDDB} receivedData Data received from client
 * @param  {object} p            player object
 * @param  {array} groupValues  averages of each group
 * @return {object}              contains groupBars and playerBars
 */
function getGroupsPlayerBars(player, receivedData, p, groupValues) {
    var playersBars = [],
    groupsBars = [],
    allPlayers,
    group,
    otherGroups;

    player = [player.value.contribution, player.value.demand];

    allPlayers = receivedData.selexec('group', '=', p.group).fetch();
    
    playersBars.push(player);
    for (player in allPlayers) {
        player = allPlayers[player];
        if (player.player !== p.id) {
            playersBars.push([player.value.contribution, player.value.demand]);
        }
    }

    group = groupValues[p.group];
    groupsBars.push(group);
    otherGroups = groupNames;
    for (group in otherGroups) {
        group = otherGroups[group];
        if (p.group !== group) {
            groupsBars.push(groupValues[group]);
        }
    }
    return {
        players: playersBars,
        groups: groupsBars,
    };
}

/**
 * Computes average contribution and demand for each group
 *
 * @param  {NDDB} receivedData Data received from clients
 * @return {array} Contains average values for each group.
 */
function getGroupValues(receivedData) {
    var groupValues = {},
    group,
    name,
    groupContrib,
    groupDemand;

    for (name in groupNames) {
        if (groupNames.hasOwnProperty(name)) {
            name = groupNames[name];
            group = receivedData.selexec('group', '=', name).fetch();
            groupContrib = group.reduce(averageContribution, 0) / group.length;
            groupDemand = group.reduce(averageDemand, 0) / group.length;
            groupValues[name] = [groupContrib, groupDemand];
        }
    }

    return groupValues;
}

/**
 * Divides a ranking array into 4 groups. NOT GROUP MATCHING
 * @param  {array} groups contains contribution and demand of players
 * @return {array}        contains arrays, which contains contribution
 */
function getGroups(groups) {
    var i, len, subGroup, gId;
    len = groups.length;
    subGroup = [];
    gId = -1;
    for (i = 0; i < len; i++) {
        if (i % SUBGROUP_SIZE == 0) {
            ++gId;
            subGroup[gId] = [];
        }
        subGroup[gId].push([groups[i].contribution]);
    }
    return subGroup;
}