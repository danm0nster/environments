/**
 * # Logic code for Meritocracy Game
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * http://www.nodegame.org
 * ---
 */

var ngc = require('nodegame-client');
var GameStage = ngc.GameStage;
var J = ngc.JSUS;


module.exports = function(treatmentName, settings, stager, setup, gameRoom) {

    var channel = gameRoom.channel;
    var node = gameRoom.node;

    var treatments;
    treatments = channel.require(__dirname + '/includes/treatments.js', {
        node: node,
        settings: settings
    }, true);

    // Event handler registered in the init function are always valid.
    stager.setOnInit(function() {
        console.log('********************** meritocracy ' + gameRoom.name);

        // Mark the stage number of the first game stage.
        node.game.firstStage = this.plot.normalizeGameStage('game').stage;

        // Keep tracks of results sent to players in case of disconnections.
        node.game.savedResults = {};

        // "STEPPING" is the last event emitted before the stage is updated.
        node.on('STEPPING', function() {
            var currentStage, db, file;

            currentStage = node.game.getCurrentGameStage();

            // We do not save stage 0.0.0.
            // Morever, If the last stage is equal to the current one,
            // we are re-playing the same stage cause of a reconnection.
            // In this case we do not update the database, or save files.
            if (!GameStage.compare(currentStage, new GameStage())) {
                return;
            }
            // Update last stage reference.
            node.game.lastStage = currentStage;

            db = node.game.memory.stage[currentStage];

            if (db && db.size()) {
                try {
                    // Saving each round results to FS.
                    file = gameRoom.dataDir + 'memory_' + currentStage;
                    db.save(file + '.csv');
                    console.log('Round data saved ', currentStage);
                }
                catch(e) {
                    console.log('OH! An error occurred while saving: ',
                                currentStage, ' ', e);
                }
            }

            console.log(node.nodename, ' - Round:  ', currentStage);
        });

        // Add session name to data in DB.
        node.game.memory.on('insert', function(o) {
            o.session = node.nodename;
        });

    });

    // Extends Stages and Steps where needed.

    stager.extendStep('bid', {
        init: function() {
            var curStage, stageRepetition;

            // It assumes 4 stage-treatments played one after another.
            curStage = node.game.getCurrentGameStage();
            stageRepetition = curStage.stage - node.game.firstStage;
            // Save a reference, so it is accessible by other functions.
            this.stageRepetition = stageRepetition;

            if (stageRepetition === 0 || stageRepetition === 2) {
                groupWithPlayers();
            }
            else if (stageRepetition === 1 || stageRepetition === 3) {
                groupWithBots();
            }
        },
        cb: function() {
            // Add bots contributions.
            if (this.stageRepetition === 1 || this.stageRepetition === 3) {
                addBotContributions();
            }
        }
    });

    stager.extendStep('results', {
        init: function() {
            this.savedResults = {};
        },
        cb: function() {
            // Computes the values for all players and all groups,
            // sends them to the clients, and save results into database.
            treatments[treatmentName].sendResults();
        }
    });

    stager.extendStep('end', {
        cb: function() {

            console.log('FINAL PAYOFF PER PLAYER');
            console.log('***********************');

            gameRoom.computeBonus({
                say: true,   // default false
                dump: true,  // default false
                print: true  // default false
                // Optional. Pre-process the results of each player.
                // cb: function(info, player) {
                // // The sum of partial results is diplayed before the total.
                //         info.partials = [ 10, -1, 7];
                // }
            });

            // Dump all memory.
            node.game.memory.save('memory_all.json');
        }
    });


    // Helper functions.

    function addBotContributions() {
        var i, nGroups;
        var db, curStage;

        db = node.game.memory;
        curStage = node.game.getCurrentGameStage()
        
        // Change nGroups accordingly (maybe move in settings).
        i = -1, nGroups = 4;
        for ( ; ++i < nGroups ; ) {
            // 3 Bots per group.
            db.insert({
                group: i,
                contribution: J.randomInt(-1, 20),
                player: 'autobot_' + i + '_1',
                stage: curStage,
                isBot: true,
                done: true
            });
            db.insert({
                group: i,
                contribution: J.randomInt(-1, 20),
                player: 'autobot_' + i + '_2',
                stage: curStage,
                isBot: true,
                done: true
            });
            db.insert({
                group: i,
                contribution: J.randomInt(-1, 20),
                player: 'autobot_' + i + '_3',
                stage: curStage,
                isBot: true,
                done: true
            });
        }
    }

    function groupWithPlayers() {
        var counter, PGROUP_SIZE, gid;
        gid = -1;
        counter = -1
        PGROUP_SIZE = 4;
        node.game.pl.each(function(p) {
            // 4 Players together.
            if (++counter % PGROUP_SIZE === 0) gid++;
            p.group = gid;
        });
    }

    function groupWithBots() {
        var counter;
        counter = -1;
        node.game.pl.each(function(p) {            
            // Each player with BOTS.
            p.group = ++counter;
        });
    }
};
