/**
 * # Treatment conditions for meritocracy game.
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * http://www.nodegame.org
 * ---
 */

var J = require('JSUS').JSUS;
var ngc = require('nodegame-client');

// Share through channel.require.
var channel = module.parent.exports.channel;
var node = module.parent.exports.node;
var settings = module.parent.exports.settings;

var SUBGROUP_SIZE = settings.SUBGROUP_SIZE;
var treatment = settings.treatmentName;
var groupNames = settings.GROUP_NAMES;


var treatments = {};
module.exports = treatments;

var GROUP_ACCOUNT_DIVIDER = settings.GROUP_ACCOUNT_DIVIDER;
var MARGINAL_PER_CAPITA_RETURN = settings.MARGINAL_PER_CAPITA_RETURN;


// Number of coins for each player at the beginning of each round
var INITIAL_COINS = settings.INITIAL_COINS;

// Functions used in map-reduce.

function averageContribution(pv, cv) {
    return pv + cv.contribution;
}

function computeGroupAccount(prev, curr) {
    return prev + curr[0];
}

// Sort by group and by contribution.
function sortContributionsDan(c1, c2) {
    if (c1.group < c2.group) return -1;
    if (c1.group > c2.group) return 1;
    if (c1.contribution > c2.contribution) return -1;
    if (c1.contribution < c2.contribution) return 1;
    if (Math.random() <= 0.5) return -1;
    return 1;
}

// If two contributions are exactly the same, then they are randomly ordered.
function sortContributions(c1, c2) {
    if (c1.contribution > c2.contribution) return -1;
    if (c1.contribution < c2.contribution) return 1;
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
    payoff = payoff * MARGINAL_PER_CAPITA_RETURN / GROUP_ACCOUNT_DIVIDER;
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
    var gId, curGId;
    len = sortedContribs.length;
    groups = [];
    ranking = [];
    bars = [];
    gId = -1;
    for (i = 0; i < len; i++) {
        entry = sortedContribs[i];
        // Group can be null if everybody is in the same group.
        curGId = entry.group || 0;
        if (gId !== curGId) {
            gId = curGId;
            groups[gId] = [];
            bars[gId] = [];
        }
        // This replaces the id with a name.
        // but it is not necessary.
        entry.group = groupNames[gId];
        groups[gId].push(entry);
        ranking.push(entry.player);
        bars[gId].push([entry.contribution, entry.demand]);
    }
    return {
        groups: groups,
        ranking: ranking,
        bars: bars
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
            entry = groups[i][j];

            cSum += entry.contribution;
            cSumSquared = Math.pow(entry.contribution, 2);

        }

        df = lenJ - 1;

        out[groupName] = {
            avgContr: cSum / lenJ,
            stdContr: df <= 1 ? 'NA' : 
                Math.sqrt((cSumSquared - (Math.pow(cSum, 2) / lenJ)) / df)
        };

    }
    return out;
}

/**
 * Send and saves received values for each player.
 */
function sendPlayersResults(pid, bars, position, payoff) {
    var finalBars;

    // Skip bots.
    if (isBot(pid)) return;

    finalBars = [ bars, position, payoff ];
    // Store it here in case of disconnection.
    node.game.savedResults[pid] = finalBars;
    node.say('results', pid, finalBars);
}

function isBot(pid) {
    return pid.substr(0, 8) === 'autobot_';
}

/**
 * We store it in registry, and send it out later with gameRoom.computeBonus
 */
function storePayoffInRegistry(p, gain) {
    var client;
    if (gain) {
        // Respondent payoff.
        client = channel.registry.getClient(p);
        client.win = !client.win ? gain : client.win + gain;
        console.log('Added ', gain, ' to ', p);
    }
}


// Saves the outcome of a round to database, and communicates it to the clients.
function finalizeRound(currentStage, bars, groupStats, groups, ranking) {

    var i, len, j, lenJ, contribObj;
    var pId, positionInRank, playerPayoff, playerBars;

    // TODO: store/save also groupStats?

    // Save the results for each player, and notify him.
    i = -1, len = groups.length;
    for (; ++i < len;) {
        j = -1, lenJ = groups[i].length;
        
        for (; ++j < lenJ;) {
            contribObj = groups[i][j];

            // Position in Rank (array of group id, position within group).
            positionInRank = [i, j];
            pId = contribObj.player;
            
            playerPayoff = getPayoff(bars, positionInRank);
            
            storePayoffInRegistry(pId, playerPayoff);

            debugger
            if (settings.SHOW_ALL_GROUPS) {
                playersBars = bars;
            }
            else {
                playerBars = [ bars[i] ];
                positionInRank = [ 0, j ];
            }
            sendPlayersResults(pId, playerBars, positionInRank, playerPayoff);
        }
    }
}

// In case of online disconnections and reconnections.
function eliminateDuplicates(receivedData) {
    var i, len, newDb, o, c, newSize;
    o = {};
    newSize = 0;
    i = -1, len = receivedData.db.length;
    for ( ; ++i < len ; ) {
        c = receivedData.db[i];
        if (!o[c.player]) {
            ++newSize;
        }
        o[c.player] = c;
        if (!isBot(c.player)) {
            c.group = node.game.pl.id.get(c.player).group;
        }
    }
    if (newSize !== receivedData.length) {
        newDb = [];
        for (i in o) {
            if (o.hasOwnProperty(i)) newDb.push(o[i]);            
        }
        receivedData = new ngc.GameDB();
        receivedData.importDB(newDb);
    }
    return receivedData;
}


// STARTING THE TREATMENTS.

// EXO PERFECT.
treatments.exo_perfect = {

    sendResults: function(stageRepetition) {
        var currentStage, previousStage,
        receivedData,
        sortedContribs,
        matching,
        ranking, groups, groupStats,
        bars;

        currentStage = node.game.getCurrentGameStage();
        previousStage = node.game.plot.previous(currentStage);

        receivedData = node.game.memory.stage[previousStage]
            .selexec('contribution');
        
        receivedData = eliminateDuplicates(receivedData);
        
        // Sort by group and player.
        sortedContribs = receivedData
            .sort(sortContributionsDan)
            .fetch();

        // Original Ranking (without noise).
        matching = doGroupMatching(sortedContribs);

        // Array of sorted player ids, from top to lowest contribution.
        ranking = matching.ranking;
        // Array of array of contributions objects.
        groups = matching.groups;
        // Compute average contrib and demand in each group.
        groupStats = computeGroupStats(groups);

        // Bars for display in clients.
        bars = matching.bars;

        // Save to db, and sends results to players.
        finalizeRound(currentStage, bars, groupStats, groups, ranking);
    }
};
