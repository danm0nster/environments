/**
 * # Game settings definition file
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * The variables in this file will be sent to each client and saved under:
 *
 *   `node.game.settings`
 *
 * The name of the chosen treatment will be added as:
 *
 *    `node.game.settings.treatmentName`
 *
 * http://www.nodegame.org
 * ---
 */

module.exports = {

    // Variables shared by all treatments.

    // Numnber of game rounds repetitions.
    // TODO: if the value is changed the QUIZ page needs to be updated.
    REPEAT: 15,

    // Minimum number of players that must be always connected.
    MIN_PLAYERS: 12,

    GROUP_NAMES: [
        '1', '2', '3', '4', '5', '6', '7', '8',
        '9', '10', '11', '12', '13', '14', '15', '16'
    ],

    // How many player in each group. *
    SUBGROUP_SIZE: 4,

    // Payment settings. *
    GROUP_ACCOUNT_DIVIDER: 4,
    INITIAL_COINS: 100,
    MARGINAL_PER_CAPITA_RETURN: 1.5,

    // If TRUE the results from all groups are shown to everybody,
    // otherwise only within group.
    SHOW_ALL_GROUPS: false,
    
    // Divider ECU / DKK *
    EXCHANGE_RATE: 0.0157,

    TIMER: {
        instructions: 3*60*1000,
        quiz: 2.5*60*1000,
        bid: function() {
            var round;
            round = this.getCurrentGameStage().round;
            if (round < 3) return 30000;
            return 15000;
        },
        results: function() {
            var round;
            round = this.getCurrentGameStage().round;
            if (round < 2) return 60000;
            if (round < 3) return 50000;
            return 30000;
        },
        information: 30000,
        questionnaire: 45000
    },

    // Treatments definition.
    // (They are actually defined in the game).

    // Custom pages depending on treatment.
    bidderPage:  'bidder.html',
    resultsPage: 'results.html',
    quizPage: 'quiz_random.html',
    informationPage: 'information.html',

    treatments: {

        exo_perfect: {
            instrPage: 'instructions_exo_perfect.html',
            quizPage: 'quiz_exo_perfect.html'
        }
    }
};
