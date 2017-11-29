/**
 * # Game stages definition file
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * Stages are defined using the stager API
 *
 * http://www.nodegame.org
 * ---
 */

module.exports = function(stager, settings) {

    stager
        .next('instructions')

        .next('quiz')

        .repeat('game', settings.REPEAT)
        .step('bid')
        .step('results')
        .next('information')
        .repeat('game AS game_with_bots', settings.REPEAT)
        .next('information AS info2')
        .repeat('game AS game_with_bots2', settings.REPEAT)
        .next('information AS info3')
        .repeat('game AS game_final', settings.REPEAT)
    
        .next('questionnaire')
    
        .next('end')

        .gameover();

    


    // Modifty the stager to skip some stages.

    stager.skip('instructions');
    stager.skip('quiz');
    // stager.skip('game');
    stager.skip('questionnaire');

    return stager.getState();
};
