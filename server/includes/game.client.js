/**
 * # Client code for Meritocracy Game
 * Copyright(c) 2014 Stefano Balietti
 * MIT Licensed
 *
 * Handles bidding, and responds between two players.
 * Extensively documented tutorial.
 *
 * http://www.nodegame.org
 * ---
 */

var ngc = module.parent.exports.ngc;
var Stager = ngc.Stager;
var stepRules = ngc.stepRules;
var constants = ngc.constants;

var stager = new Stager();
var game = {};

var settings = module.parent.exports.settings;

//Number Of required players to play the game:
var nbRequiredPlayers = settings.MIN_PLAYERS;

module.exports = game;

// GLOBALS

game.globals = {};

// INIT and GAMEOVER

stager.setOnInit(function() {
    var that = this;
    var waitingForPlayers, treatment;
    
    console.log('INIT PLAYER!');
    
    node.game.INITIAL_COINS = node.env('INITIAL_COINS');
    
    node.game.oldContrib = null;
    node.game.oldDemand = null;
    node.game.oldPayoff = null;

    // Change so that roomtype is set as decided in game.room.
    node.game.roomType = node.env('roomType');

    // Adapting the game to the treatment.
    node.game.instructionsPage = '/meritocracy/html/';
    node.game.bidderPage = '/meritocracy/html/';
    node.game.resultsPage = '/meritocracy/html/';
    node.game.quizPage = '/meritocracy/html/';
    
    if (node.game.roomType === 'endo') {
        node.game.bidderPage += 'bidder_endo.html';
        node.game.resultsPage += 'results_endo.html';
        node.game.instructionsPage += 'instructions_endo.html';
        node.game.quizPage += 'quiz_endo.html';
    }
    else if (node.game.roomType === 'blackbox') {
        node.game.bidderPage += 'bidder_blackbox.html';
        node.game.resultsPage += 'results_blackbox.html';
        node.game.instructionsPage += 'instructions_blackbox.html';
        node.game.quizPage += 'quiz_blackbox.html'
    }
    else {
        node.game.bidderPage += 'bidder.html';
        node.game.resultsPage += 'results.html';
        
        if (node.game.roomType === 'random') {
            node.game.instructionsPage += 'instructions_random.html';
            node.game.quizPage += 'quiz_random.html'
        }
        else if (node.game.roomType === 'exo_perfect') {
            node.game.instructionsPage += 'instructions_exo_perfect.html';
            node.game.quizPage += 'quiz_exo_perfect.html'
        }
        else {
            node.game.instructionsPage += 'instructions_exo_lowhigh.html';
            node.game.quizPage += 'quiz_exo_lowhigh.html';
        }     
    }

    // Hide the waiting for other players message.
    waitingForPlayers = W.getElementById('waitingForPlayers');
    waitingForPlayers.innerHTML = '';
    waitingForPlayers.style.display = 'none';

    // Set up the main screen:
    // - visual timer widget,
    // - visual state widget,
    // - state display widget,
    // - iframe of play,
    // - player.css
    W.setupFrame('PLAYER');

    node.on('BID_DONE', function(bid, isTimeOut) {
        node.game.timer.stop();
        W.getElementById('submitOffer').disabled = 'disabled';
        node.set('bid', {
            demand: bid.demand,
            contribution: bid.contrib,
            isTimeOut: isTimeOut
        });
        node.game.oldContrib = bid.contrib;
        node.game.oldDemand = bid.demand;

        console.log(' Your contribution: ' + bid.contrib + '.');
        console.log(' Your demand: ' + bid.demand + '.');
        node.done();
    });

    this.shouldCheckDemand = function() {
        return node.env('roomType') === "endo";
    };

    // Takes in input the results of _checkInputs_ and correct eventual
    // mistakes. If in the first round a random value is chosen, otherwise
    // the previous decision is repeated. It also updates the screen.
    this.correctInputs = function(checkResults) {
        var contrib, demand, previousChoice;
        var errorC, errorD;

        if (checkResults.success) {
            contrib = parseInt(W.getElementById('contribution').value, 10);

            if (node.game.shouldCheckDemand()) {
                demand = parseInt(W.getElementById('demand').value, 10);
            }
        }
        else {

            if (checkResults.errContrib) {

                if (!node.game.oldContrib) {
                    contrib = JSUS.randomInt(-1, 20);
                }
                else {
                    contrib = node.game.oldContrib;
                }
                errorC = document.createElement('p');
                errorC.innerHTML = 'Your contribution was set to ' + contrib;
                W.getElementById('divErrors').appendChild(errorC);
                W.getElementById('contribution').value = contrib;
            }

            // In ENDO we check the demand too.
            if (checkResults.errDemand) {

                if (!node.game.oldDemand) {
                    demand = JSUS.randomInt(-1, 20);
                }
                else {
                    demand = node.game.oldDemand;
                }
                errorD = document.createElement('p');
                errorD.innerHTML = 'Your demand was set to ' + demand;
                W.getElementById('divErrors').appendChild(errorD);
                W.getElementById('demand').value = demand;
            }
        }

        return {
            contrib: contrib,
            demand: demand
        };
    };

    // Retrieves and checks the current input for contribution, and for
    // demand (if requested). Returns an object with the results of the
    // validation. It also displays a message in case errors are found.
    this.checkInputs = function() {
        var contrib, demand, values;
        var divErrors, errorC, errorD;

        divErrors = W.getElementById('divErrors');

        // Clear previous errors.
        divErrors.innerHTML = '';

        // Always check the contribution.
        contrib = W.getElementById('contribution').value;

        if (!node.game.isValidContribution(contrib)) {
            errorC = document.createElement('p');
            errorC.innerHTML = 'Invalid contribution. ' +
                'Please enter a number between 0 and 20.';
            divErrors.appendChild(errorC);
        }

        // In ENDO we check the demand too.
        if (node.game.shouldCheckDemand()) {

            demand = W.getElementById('demand').value;

            if (!node.game.isValidDemand(demand)) {
                errorD = document.createElement('p');
                errorD.innerHTML = 'Invalid demand. ' +
                    'Please enter a number between 0 and 20.';
                divErrors.appendChild(errorD);
            }
        }

        return {
            success: !(errorC || errorD),
            errContrib: !!errorC,
            errDemand: !!errorD
        };
    };

    // This function is called to create the bars.
    this.updateResults = function(barsValues) {
        var group, player, i, j, div, subdiv, color, save;
        var barsValues, barsDiv, showDemand, myPayoff;
        var text, groupHeader, groupHeaderText, groupNames;

        // Notice: _barsValues_ array:
        // 0: array of array: contr, demand by group
        // 1: array: group, position in group
        // 2: array of array: allPayoffs by group
        // 3: array: groups are compatible or not (only endo)

        groupNames = ['A', 'B', 'C', 'D'];

        showDemand = node.env('roomType') === 'endo';

//        console.log(barsValues);
//        console.log(showDemand);

        barsDiv = W.getElementById('barsResults');
        payoffSpan = W.getElementById('payoff');

        barsDiv.innerHTML = '';

        bars = W.getFrameWindow().bars;

        for (i = 0; i < barsValues[0].length; i++) {
            group = barsValues[0][i];
            div = document.createElement('div');
            div.classList.add('groupContainer');
            groupHeader = document.createElement('h4');
            groupHeaderText = 'Group ' + groupNames[i];
            if (showDemand) {
                groupHeaderText += barsValues[3][i] ? ' (' : ' (not ';
                groupHeaderText += 'compatible)';
            }
            groupHeader.innerHTML = groupHeaderText;
            barsDiv.appendChild(div);
            div.appendChild(groupHeader);

            for (j = 0; j < group.length; j++) {

                player = group[j];
                
                // Uncomment this to show the payoff.
                // text = ' (' + barsValues[2][i][j] + ')';
                text = ''; 

                // It is me?
                if (barsValues[1][0] === i && barsValues[1][1] === j) {
                    color = [undefined, '#9932CC'];
                    text += ' YOU <-----';
                    myPayoff = +barsValues[2][i][j];
                }
                else {
                    color = ['#DEB887', '#A52A2A'];
                }
                
                // This is the DIV actually containing the bar
                subdiv = document.createElement('div');
                div.appendChild(subdiv);
                bars.createBar(subdiv, player[0], 20, color[0], text);

                if (showDemand) {
                    subdiv.classList.add('playerContainer');
                    text = '';
                    // It is me?
                    if (barsValues[1][0] === i && barsValues[1][1] === j) {
                        text = ' YOU <-----';
                    }
                    bars.createBar(subdiv, player[1], 20, color[1], text);
                }
                // Was here
                // div.appendChild(subdiv);
            }
            // Was here
            // barsDiv.appendChild(div);
        }

        node.game.oldPayoff = myPayoff; // final payoff

        // How many coins player put in personal account.
        save = node.game.INITIAL_COINS - node.game.oldContrib;
        payoffSpan.innerHTML = save + ' + ' + (myPayoff - save) + 
            ' = ' + myPayoff;
    };

    this.isValidContribution = function(n) {
        n = parseInt(n, 10);
        return !isNaN(n) && isFinite(n) && n >= 0 && n <= 20;
    };

    this.isValidDemand = function(n) {
        n = parseInt(n, 10);
        return !isNaN(n) && isFinite(n) && n >= 0 && n <= 20;
    };

    this.displaySummaryPrevRound = function(treatment) {
        var save, groupReturn;

        // Shows previous round if round number is not 1.
        if (node.game.oldContrib) {

            save = node.game.INITIAL_COINS - node.game.oldContrib;
            groupReturn = node.game.oldPayoff - save;

            W.getElementById('previous-round-info').style.display = 'block';
            // Updates display for current round.
            W.getElementById('yourPB').innerHTML = save;
            W.getElementById('yourOldContrib').innerHTML = node.game.oldContrib;
            W.getElementById('yourReturn').innerHTML = groupReturn;
            W.getElementById('yourPayoff').innerHTML = node.game.oldPayoff;

            if (treatment === 'endo') {
                W.getElementById('yourOldDemand').innerHTML =
                    node.game.oldDemand;
            }
        }
    };

    // Remove the content of the previous frame before loading the next one.
    node.on('STEPPING', function() {
        W.clearFrame();
    });

    
    node.on.data('notEnoughPlayers', function(msg) {
        // Not yet 100% safe. Some players could forge the from field.
        if (msg.from !== '[ADMIN_SERVER]') return;

        node.game.pause();
        W.lockScreen('One player disconnected. We are now waiting to see if ' +
                     'he or she reconnects. If not, the game will continue ' +
                     'with fewer players.');
    });

    node.on('SOCKET_DISCONNECT', function() {
        alert('Connection with the server was terminated. If you think ' +
              'this is an error, please try to refresh the page. You can ' +
              'also look for a HIT called ETH Descil Trouble Ticket for ' +
              'nodeGame and file an error report. Thank you for your ' +
              'collaboration.');
    });

});

stager.setOnGameOver(function() {
    // Do something.
});

///// STAGES and STEPS

function precache() {
    W.lockScreen('Loading...');
    node.done();
    // Disabled for the moment. It does not reload the QUIZ script.
    return;

    W.preCache([
        node.game.instructionsPage,
        node.game.quizPage,
        // node.game.bidderPage,  // these two are cached by following
        // node.game.resultsPage,    // loadFrame calls (for demonstration)
        '/meritocracy/html/postgame.html',
        '/meritocracy/html/ended.html'
    ], function() {
        // Pre-Caching done; proceed to the next stage.
        node.done();
    });
}

function instructions() {
    W.loadFrame(node.game.instructionsPage, function() {
        var b = W.getElementById('read');
        b.onclick = function() {
            node.done();
        };
        node.env('auto', function() {
            node.timer.randomEmit('DONE', 8000);
        });
    });

    console.log('Instructions');
}

function quiz() {
    W.loadFrame(node.game.quizPage, function() {
        node.env('auto', function() {
            node.timer.randomEmit('DONE', 8000);
        });
    });

    console.log('Quiz');
}

function showResults(bars) {

    W.loadFrame(node.game.resultsPage, function() {
        node.on.data('results', function(msg) {
            var treatment, b;
            console.log('Received results.');

            barsValues = msg.data;
            treatment = node.env('roomType');

            if (treatment === 'endo') {
                W.getElementById('yourOldDemand').innerHTML =
                    node.game.oldDemand;
            }

            this.updateResults(barsValues);

            b = W.getElementById('submitOffer');
            b.onclick = function() {
                node.done();
            };

            node.env('auto', function() {
                node.timer.randomEmit('DONE', 6000);
            });
        });
    });
}

function bid() {

    var that = this;

    //////////////////////////////////////////////
    // nodeGame hint:
    //
    // W.loadFrame takes an optional third 'options' argument which can
    // be used to request caching of the displayed frames (see the end
    // of the following function call). The caching mode can be set with
    // two fields: 'loadMode' and 'storeMode'.
    //
    // 'loadMode' specifies whether the frame should be reloaded
    // regardless of caching (loadMode = 'reload') or whether the frame
    // should be looked up in the cache (loadMode = 'cache', default).
    // If the frame is not in the cache, it is always loaded from the
    // server.
    //
    // 'storeMode' says when, if at all, to store the loaded frame. By
    // default the cache isn't updated (storeMode = 'off'). The other
    // options are to cache the frame right after it has been loaded
    // (storeMode = 'onLoad') and to cache it when it is closed, that
    // is, when the frame is replaced by other contents (storeMode =
    // 'onClose'). This last mode preserves all the changes done while
    // the frame was open.
    //
    /////////////////////////////////////////////
    W.loadFrame(node.game.bidderPage, function() {
        var toHide, i;
        var b, options, other;
        var treatment;

        treatment = node.env('roomType');

        node.game.displaySummaryPrevRound(treatment);

        // Re-enable input.
        W.getElementById('submitOffer').disabled = '';
        // Clear previous errors.
        W.getElementById('divErrors').innerHTML = '';

        // Clear contribution and demand inputs.
        if (treatment === 'endo') {
            W.getElementById('demand').value = '';   
        }

        W.getElementById('contribution').value = '';

        b = W.getElementById('submitOffer');

        // AUTOPLAY.
        node.env('auto', function() {
            node.timer.randomExec(function() {
                validation = node.game.checkInputs();
                validInputs = node.game.correctInputs(validation);
                node.emit('BID_DONE', validInputs, false);
            }, 4000);
        });

        // TIMEUP.
        node.on('TIMEUP', function() {
            var validation;
            console.log('TIMEUP !');
            validation = node.game.checkInputs();
            validInputs = node.game.correctInputs(validation);
            node.emit('BID_DONE', validInputs, true);
        });

        b.onclick = function() {
            var validation;
            validation = node.game.checkInputs();
            if (!validation.success) return;
            validInputs = node.game.correctInputs(validation);
            node.emit('BID_DONE', validInputs, false);
        };

    });

    console.log('Meritocracy: bid page.');
}

function postgame() {
    W.loadFrame('/meritocracy/html/postgame.html', function() {

        node.env('auto', function() {
	    node.timer.randomExec(function() {
                // node.game.timer.doTimeUp();
            });
	});
     
    });
    console.log('Postgame');
}

function endgame() {
    W.loadFrame('/meritocracy/html/ended.html', function() {
	node.game.timer.setToZero();
        node.on.data('WIN', function(msg) {
            var win, exitcode, codeErr;
            codeErr = 'ERROR (code not found)';
            win = msg.data && msg.data.win || 0;
            exitcode = msg.data && msg.data.exitcode || codeErr;
	    W.writeln('Your bonus in this game is: ' + win);
            W.writeln('Your exitcode is: ' + exitcode);
	});
    });

    console.log('Game ended');
}

function clearFrame() {
    node.emit('INPUT_DISABLE');
    // We save also the time to complete the step.
    node.set('timestep', {
        time: node.timer.getTimeSince('step'),
        timeup: node.game.timer.gameTimer.timeLeft <= 0
    });
    return true;
}

// Add all the stages into the stager.

//////////////////////////////////////////////
// nodeGame hint:
//
// A minimal stage must contain two properties:
//
// - id: a unique name for the stage
// - cb: a callback function to execute once
//     the stage is loaded.
//
// When adding a stage / step into the stager
// there are many additional options to
// configure it.
//
// Properties defined at higher levels are
// inherited by each nested step, that in turn
// can overwrite them.
//
// For example if a step is missing a property,
// it will be looked into the enclosing stage.
// If it is not defined in the stage,
// the value set with _setDefaultProperties()_
// will be used. If still not found, it will
// fallback to nodeGame defaults.
//
// The most important properties are used
// and explained below.
//
/////////////////////////////////////////////

// A step rule is a function deciding what to do when a player has
// terminated a step and entered the stage level _DONE_.
// Other stepRules are: SOLO, SYNC_STAGE, SYNC_STEP, OTHERS_SYNC_STEP.
// In this case the client will wait for command from the server.
stager.setDefaultStepRule(stepRules.WAIT);

stager.addStage({
    id: 'precache',
    cb: precache,
    // `minPlayers` triggers the execution of a callback in the case
    // the number of players (including this client) falls the below
    // the chosen threshold. Related: `maxPlayers`, and `exactPlayers`.
    // minPlayers: [nbRequiredPlayers, notEnoughPlayers],
    // syncOnLoaded: true,
    done: clearFrame
});

stager.addStage({
    id: 'instructions',
    cb: instructions,
    // minPlayers: [nbRequiredPlayers, notEnoughPlayers],
    // syncOnLoaded: true,
    timer: 180000,
    done: clearFrame
});

stager.addStage({
    id: 'quiz',
    cb: quiz,
    // minPlayers: [nbRequiredPlayers, notEnoughPlayers],
    // syncOnLoaded: true,
    // `timer` starts automatically the timer managed by the widget VisualTimer
    // if the widget is loaded. When the time is up it fires the DONE event.
    // It accepts as parameter:
    //  - a number (in milliseconds),
    //  - an object containing properties _milliseconds_, and _timeup_
    //     the latter being the name of the event to fire (default DONE)
    // - or a function returning the number of milliseconds.
    timer: 120000,
    done: function() {
        console.log('EXECUTING DONE HANDLER!!');
        node.set('QUIZ', node.game.quizResults);
        node.emit('INPUT_DISABLE');
        // We save also the time to complete the step.
        node.set('timestep', {
            time: node.timer.getTimeSince('step'),
            timeup: node.game.timer.gameTimer.timeLeft <= 0
        });
        return true;
    }
});

stager.addStep({
    id: 'bid',
    cb: bid,
    done: clearFrame,
    timer: {
	milliseconds: function() {
	    if (node.game.getCurrentGameStage().round < 3) return 30000;
	    return 15000;
	},
        timeup: 'TIMEUP'
    }
});

stager.addStep({
    id: 'results',
    cb: showResults,
    timer: function() {
        var round;
        round = node.game.getCurrentGameStage().round;
	if (round < 2) return 60000;
	if (round < 3) return 50000;
	return 30000;        
    },
    done: clearFrame
});

stager.addStage({
    id: 'meritocracy',
    steps: ['bid', 'results'],
    // `syncOnLoaded` forces the clients to wait for all the others to be
    // fully loaded before releasing the control of the screen to the players.
    // This options introduces a little overhead in communications and delay
    // in the execution of a stage. It is probably not necessary in local
    // networks, and it is FALSE by default.
    // syncOnLoaded: true,
    // minPlayers: [nbRequiredPlayers, notEnoughPlayers]
});

stager.addStage({
    id: 'endgame',
    cb: endgame,
    // `done` is a callback function that is executed as soon as a
    // _DONE_ event is emitted. It can perform clean-up operations (such
    // as disabling all the forms) and only if it returns true, the
    // client will enter the _DONE_ stage level, and the step rule
    // will be evaluated.
    done: clearFrame
});

stager.addStage({
    id: 'questionnaire',
    cb: postgame,
    timer: 120000,
    done: function() {
        var i, socExpValue, stratChoiceValue;
        T = W.getFrameDocument(),
        gameName = T.getElementById('game-name').value,
        stratComment = T.getElementById('strategy-comment').value,
        socExp = T.getElementsByName('played-other-experiment'),
        stratChoice = T.getElementsByName('followed-strategy-choice'),
        comments = T.getElementById('comment').value;

        var errors = [], 
        stratCommentErr = false,
        errDiv = null;

        // Getting values of form.
        for (i = 0; i < socExp.length; i++) {
            if (socExp[i].checked) {
                socExpValue = socExp[i].value;
                break;
            }
        }

        for (i = 0; i < stratChoice.length; i++) {
            if (stratChoice[i].checked) {
                stratChoiceValue = stratChoice[i].value;
                break;
            }
        }

        // Checking if values are correct.

        if (gameName === '') {
            errors.push('1.');
        }

        if ('undefined' === typeof socExpValue) {
            errors.push('2.');
        }
        
        if ('undefined' === typeof stratChoiceValue) {
            errors.push('3.');
        }

        if (stratChoiceValue === 'other') {
            if (stratComment.length < 5) {
                errors.push('3.');
                stratCommentErr = true;
            }
        }

        isTimeUp = node.game.timer.gameTimer.timeLeft <= 0;

        if (errors.length && !isTimeUp) {
            errDiv = W.getElementById('divErrors');
            errors = '<p>Please answer question' +
                (errors.length === 1 ? ' ' + errors[0] :
                 's ' + errors.join(' ')) + '</p>';

            if (stratCommentErr) {
                errors += '<p>Answer 3. is too short.</p>';
            }

            errDiv.innerHTML = errors;
            return false;
        }

        console.log({
            gameName: gameName,
            socExp: socExpValue,
            stratChoice: stratChoiceValue,
            comments: comments,
            stratComment: stratComment
        });

        // Sending values to server.
        node.set('questionnaire', {
            gameName: gameName,
            socExp: socExpValue,
            stratChoice: stratChoiceValue,
            comments: comments,
            stratComment: stratComment            
        });
     
        node.emit('INPUT_DISABLE');        
        node.set('timestep', {
            time: node.timer.getTimeSince('step'),
            timeup: isTimeUp
        });
        return true;
    }
});


// Now that all the stages have been added,
// we can build the game plot

stager.init()
    .next('precache')
    .next('instructions')
    .next('quiz')
    .repeat('meritocracy', settings.REPEAT)
    .next('questionnaire')
    .next('endgame')
    .gameover();

// We serialize the game sequence before sending it.
game.plot = stager.getState();

// Let's add the metadata information.
game.metadata = {
    name: 'meritocracy',
    version: '0.0.1',
    session: 1,
    description: 'no descr'
};

// Other settings, optional.
game.settings = {
    publishLevel: 2
};
game.env = {
    auto: settings.AUTO,
    INITIAL_COINS: settings.INITIAL_COINS
};
game.verbosity = 100;