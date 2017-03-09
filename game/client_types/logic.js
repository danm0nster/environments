/**
 * # Logic code for Meritocracy Game
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * http://www.nodegame.org
 * ---
 */

var path = require('path');
var fs   = require('fs-extra');

var ngc = require('nodegame-client');
var Stager = ngc.Stager;
var stepRules = ngc.stepRules;
var GameStage = ngc.GameStage;
var J = ngc.JSUS;


module.exports = function(treatmentName, settings, stager, setup, gameRoom) {

    var channel = gameRoom.channel;
    var node = gameRoom.node;

    var EXCHANGE_RATE = settings.EXCHANGE_RATE;

    // Variable registered outside of the export function are shared among all
    // instances of game logics.
    var counter = settings.SESSION_ID;

    var DUMP_DIR, DUMP_DIR_JSON, DUMP_DIR_CSV;

    var treatments;
    var nbRequiredPlayers;

    // Preparing storage directories.
    
    DUMP_DIR = channel.getGameDir() + '/data/' + counter + '/';
    DUMP_DIR_JSON = DUMP_DIR + 'json/';
    DUMP_DIR_CSV = DUMP_DIR + 'csv/';

    // Recursively create directories.
    fs.mkdirsSync(DUMP_DIR_JSON);
    fs.mkdirsSync(DUMP_DIR_CSV);

    // Require treatments file.
    treatments = channel.require(__dirname + '/includes/treatments.js', {
        node: node,
        settings: settings
    }, true);

    
    // Players required to be connected at the same (NOT USED).
    nbRequiredPlayers = gameRoom.runtimeConf.MIN_PLAYERS;
    stager.setDefaultProperty('minPlayers', nbRequiredPlayers);

    // Event handler registered in the init function are always valid.
    stager.setOnInit(function() {
        console.log('********************** meritocracy room ' + counter++);

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
                    file = DUMP_DIR + 'memory_' + currentStage;

                    // Saving results to FS.
                    db.save(file + '.csv', { flags: 'w' });
                    db.save(file + '.json');

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

    stager.extendStep('results', {
        init: function() {            
            // Keep tracks of results sent to players
            // in case of disconnections.
            this.savedResults = {};
        },
        cb: function() {
            // Computes the values for all players and all groups,
            // sends them to the clients, and save results into database.
            treatments[treatmentName].sendResults();
            return true;
        },
        // Callback executed when a clients reconnects.
        reconnect: function(p) {
            setTimeout(function() {
                // Send results (make sure that client is ready).
                node.say('results', p.id, node.game.savedResults[p.id]);                
            }, 200);
        }
    });

    stager.extendStep('end', {
        cb: function() {
            var code, exitcode, accesscode;
            var bonusFile, bonus, csvString;

            console.log('endgame');

            bonusFile = DUMP_DIR + 'bonus.csv';

            console.log('FINAL PAYOFF PER PLAYER');
            console.log('***********************');

            bonus = node.game.pl.map(function(p) {
                code = channel.registry.getClient(p.id);
                if (!code) {
                    console.log('ERROR: no code in endgame:', p.id);
                    return ['NA', 'NA'];
                }

                accesscode = code.AccessCode;
                exitcode = code.ExitCode;

                code.win =  Number((code.win || 0) / EXCHANGE_RATE).toFixed(2);
                code.win = parseFloat(code.win, 10);

                channel.registry.checkOut(p.id);

                node.say('WIN', p.id, {
                    win: code.win,
                    exitcode: code.ExitCode
                });

                console.log(p.id, ': ',  code.win, code.ExitCode);
                return [
                    p.id, code.ExitCode, code.win, node.game.gameTerminated
                ];
            });

            console.log('***********************');
            console.log('Game ended');


            bonus = [["access", "exit", "bonus", "terminated"]].concat(bonus);
            csvString = bonus.join("\r\n");
            fs.writeFile(bonusFile, csvString, function(err) {
                if (err) {
                    console.log('ERROR: could not save the bonus file: ',
                                DUMP_DIR + 'bonus.csv');
                    console.log(err);
                }
            });
        }
    });

    return {
        nodename: 'lgc' + counter,
        plot: stager.getState()
    };

};
