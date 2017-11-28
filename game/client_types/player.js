/**
 * # Player code for Meritocracy Game
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * http://www.nodegame.org
 * ---
 */

module.exports = function(treatmentName, settings, stager, setup, gameRoom) {
    
    // Variable here are available to all stages.
    stager.setDefaultGlobals({
        // Total number of players in group.
        totPlayers: gameRoom.game.waitroom.GROUP_SIZE,
    });

    stager.setOnInit(function() {
        var header, frame;
        var COINS;

        console.log('INIT PLAYER!');

        COINS = node.game.settings.INITIAL_COINS;
        node.game.oldContrib = null;
        node.game.oldPayoff = null;

        // Setup page: header + frame.
        header = W.generateHeader();
        frame = W.generateFrame();

        // Add widgets.
        this.visualRound = node.widgets.append('VisualRound', header, {
            title: false
        });
        this.visualTimer = node.widgets.append('VisualTimer', header);
        this.doneButton = node.widgets.append('DoneButton', header);

        this.isValidContribution = function(n) {
            return false !== J.isInt(n, -1, (COINS + 1));
        };
        
        // Takes in input the results of _checkInputs_ and correct eventual
        // mistakes. If in the first round a random value is chosen, otherwise
        // the previous decision is repeated. It also updates the screen.
        this.correctInputs = function(checkResults) {
            var contrib;
            var errorC, errorD;

            if (checkResults.success) {
                contrib = parseInt(W.getElementById('contribution').value, 10);
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
                    errorC.innerHTML = 'Your contribution was set to ' +contrib;
                    W.getElementById('divErrors').appendChild(errorC);
                    W.getElementById('contribution').value = contrib;
                }
            }

            return {
                contribution: contrib
            };
        };

        // Retrieves and checks the current input for contribution.
        // Returns an object with the results of the
        // validation. It also displays a message in case errors are found.
        this.checkInputs = function() {
            var contrib;
            var divErrors, errorC, errorD;

            divErrors = W.getElementById('divErrors');

            // Clear previous errors.
            divErrors.innerHTML = '';

            // Always check the contribution.
            contrib = W.getElementById('contribution').value;

            if (!node.game.isValidContribution(contrib)) {
                errorC = document.createElement('p');
                errorC.innerHTML = 'Invalid contribution. ' +
                    'Please enter a number between 0 and ' + COINS;
                divErrors.appendChild(errorC);
            }

            return {
                success: !(errorC || errorD),
                errContrib: !!errorC
            };
        };

        // This function is called to create the bars.
        this.updateResults = function(barsValues) {
            var group, player, i, j, div, subdiv, color, save;
            var barsDiv;
            var text, groupHeader, groupHeaderText, groupNames;
            var payoffSpan, bars;

            // Notice: _barsValues_ array:
            // 0: array: contr, demand
            // 1: array: group, position in group
            // 2: payoff

            groupNames = node.game.settings.GROUP_NAMES;
            
            barsDiv = W.getElementById('barsResults');
            payoffSpan = W.getElementById('payoff');

            barsDiv.innerHTML = '';

            bars = W.getFrameWindow().bars;

            for (i = 0; i < barsValues[0].length; i++) {
                group = barsValues[0][i];
                div = document.createElement('div');
                div.classList.add('groupContainer');
                groupHeader = document.createElement('h4');
                groupHeaderText = 'Your group'; //'Group ' + groupNames[i];
                
                groupHeader.innerHTML = groupHeaderText;
                barsDiv.appendChild(div);
                div.appendChild(groupHeader);
                for (j = 0; j < group.length; j++) {

                    player = group[j];

                    // It is me?
                    if (barsValues[1][0] === i && barsValues[1][1] === j) {
                        color = [ undefined, '#9932CC' ];
                        text = ' YOU <img src="imgs/arrow.jpg" ' +
                            'style="height:15px;"/>';
                    }
                    else {
                        color = [ '#DEB887', '#A52A2A' ];
                        text = '';
                    }

                    // This is the DIV actually containing the bar
                    subdiv = document.createElement('div');
                    div.appendChild(subdiv);
                    bars.createBar(subdiv, player[0], COINS, color[0], text);
                }
            }

            node.game.oldPayoff = +barsValues[2]; // final payoff

            // How many coins player put in personal account.
            save = COINS - node.game.oldContrib;
            payoffSpan.innerHTML = save + ' + ' + (barsValues[2] - save) +
                ' = ' + node.game.oldPayoff;
        };

        this.displaySummaryPrevRound = function() {
            var save, groupReturn;

            // Shows previous round if round number is not 1.
            if (node.game.oldContrib) {

                save = COINS - node.game.oldContrib;
                groupReturn = node.game.oldPayoff - save;

                W.getElementById('previous-round-info').style.display = 'block';

                // Updates display for current round.
                W.setInnerHTML('yourPB', save);
                W.setInnerHTML('yourOldContrib', node.game.oldContrib);
                W.setInnerHTML('yourReturn', groupReturn);
                W.setInnerHTML('yourPayoff', node.game.oldPayoff);
            }
        };
        
        node.on('SOCKET_DISCONNECT', function() {
            // Disabled.
            return;
            alert('Connection with the server was terminated. If you think ' +
                  'this is an error, please try to refresh the page. You can ' +
                  'also look for a HIT called ETH Descil Trouble Ticket for ' +
                  'nodeGame and file an error report. Thank you for your ' +
                  'collaboration.');
        });

    });

    // STAGES and STEPS.

    stager.extendStep('instructions', {
        frame: settings.instrPage,
        cb: function() {
            var n, s;
            s = node.game.settings;
            n = node.game.globals.totPlayers;
            W.setInnerHTML('players-count', n);
            W.setInnerHTML('players-count-minus-1', (n-1));
            W.setInnerHTML('rounds-count', s.REPEAT);
            console.log('Instructions');
        }
    });

    stager.extendStep('quiz', {
        frame: 'quiz.html',
        init: function() {
            this.quizStuff = {
                // Coins.
                coins: 'How many coins do you get in each round?',
                coinsChoices: [ 20, 100, 10, 'Other' ],
                coinsCorrect: 1,
                // Lowest Pay.
                lowestPay: 'If you put 40 coins in the group account, what is the ' +
                    'lowest payment you are guaranteed from this round ?',
                lowestPayChoices: [ 115, 120, 75, 'Other' ],
                lowestPayCorrect: 2,
                // Guarantee Pay.
                guaranteePay: 'If you put 30 coins in the group account, and all ' +
                    'others do the same, how much are you guaranteed from ' +
                    'this round ?',
                guaranteePayChoices: [ 145, 115, 82, 'Other' ],
                guaranteePayCorrect: 1,
                // Group composition.
                maxPay: 'What is the highest number of coins you can get ' +
                    'paid in a round?',
                maxPayChoices: [ 150, 400, 212.50, 'Other'],
                maxPayCorrect: 2
            };
        },
        cb: function() {
            var w, qs, t;
            t = this.settings.treatmentName;
            qs = this.quizStuff;

            /////////////////////////////////////////////////////////////
            // nodeGame hint: the widget collection
            //
            // Widgets are re-usable components with predefined methods,
            // such as: hide, highlight, disable, getValues, etc.
            // Here we use the `ChoiceManager` widget to create a quiz page.
            w = node.widgets;
            this.quiz = w.append('ChoiceManager', W.getElementById('root'), {
                id: 'quizzes',
                title: false,
                forms: [
                    w.get('ChoiceTable', {
                        id: 'coinsEveryRound',
                        shuffleChoices: true,
                        title: false,
                        choices: qs.coinsChoices,
                        correctChoice: qs.coinsCorrect,
                        mainText: qs.coins
                    }),
                    w.get('ChoiceTable', {
                        id: 'lowestPayment',
                        shuffleChoices: true,
                        title: false,
                        choices: qs.lowestPayChoices,
                        correctChoice: qs.lowestPayCorrect,
                        mainText: qs.lowestPay
                    }),
                    w.get('ChoiceTable', {
                        id: 'leastGuarantee',
                        shuffleChoices: true,
                        title: false,
                        choices: qs.guaranteePayChoices,
                        correctChoice: qs.guaranteePayCorrect,
                        mainText: qs.guaranteePay
                    }),
                    w.get('ChoiceTable', {
                        id: 'likeliness',
                        shuffleChoices: true,
                        title: false,
                        choices: qs.maxPayChoices,
                        correctChoice: qs.maxPayCorrect,
                        mainText: qs.maxPay
                    })
                ]
            });
        },
        done: function() {
            var answers, isTimeup;
            answers = this.quiz.getValues({
                markAttempt: true,
                highlight: true
            });
            isTimeup = node.game.timer.isTimeup();
            if (!answers.isCorrect && !isTimeup) return false;
            return answers;
        }
    });

    stager.extendStep('bid', {
        frame: settings.bidderPage,
        cb: function() {
            // Show summary previous round.
            node.game.displaySummaryPrevRound();

            // Set the number of coins
            W.setInnerHTML('initialCoins', node.game.settings.INITIAL_COINS);

            // Clear previous errors.
            W.setInnerHTML('divErrors', '');

            // Clear contribution input.
            W.getElementById('contribution').value = '';
            
            console.log('Meritocracy: bid page.');
        },
        done: function() {
            var validation, bid;
            validation = node.game.checkInputs();
            // Do not go forward if it is not timeup and validation failed.
            if (!node.game.timer.isTimeup() && !validation.success) {
                return false;
            }
            bid = node.game.correctInputs(validation);
            // Store reference for next round.
            node.game.oldContrib = bid.contribution;
            // Send it to server.
            return bid;
        }
    });

    stager.extendStep('results', {
        frame: settings.resultsPage,
        cb: function () {
            node.on.data('results', function(msg) {
                var treatment, barsValues;

                console.log('Received results.');

                barsValues = msg.data;
                treatment = node.env('roomType');

                this.updateResults(barsValues);
            });
        }
    });

    stager.extendStep('questionnaire', {
        frame: 'postgame.html',
        widget: {
            name: 'ChoiceManager',
            root: 'root',
            options: {
                id: 'questionnaire',
                title: false,
                forms:  [
                    {
                        name: 'ChoiceTable',
                        id: 'alreadyParticipated',
                        choices: [ 'Yes', 'No' ],
                        requiredChoice: true,
                        title: false,
                        mainText: 'Have you participated in other ' +
                            'social experiments before ?'
                    },
                    {
                        name: 'ChoiceTable',
                        id: 'strategy',
                        choices: [
                            [ 'random', 'Randomly chose numbers' ],
                            [ 'egoist', 'Maximized my own personal payoff' ],
                            [ 'team', 'Maximized group payoff' ],
                            [ 'other', 'Other (please described below)' ]
                        ],
                        title: false,
                        orientation: 'v',
                        requiredChoice: true,
                        mainText: 'Describe the strategy you played:'
                    }
                ],
                freeText: 'Leave here any feedback for the experimenter'
            }
        }
    });

    stager.extendStep('end', {
        frame: 'ended.html',
        widget: {
            name: 'EndScreen',
            root: 'root',
            options: {
                panel: false,
                title: false,
                feedback: false,
                exitCode: false,
                email: false
            }
        }
    });
};
