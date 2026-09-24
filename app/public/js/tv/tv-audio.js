window.TVApp = window.TVApp || {};
window.TVApp.Audio = (function () {
    'use strict';

    let tickSound = null;
    let questionAudio = null;

    function initAudio() {
        if (!tickSound) {
            tickSound = new Audio('/audio/bip.wav');
            tickSound.preload = 'auto';
            tickSound.volume = 0.8;
            try {
                tickSound.load();
            } catch (e) {
                console.log('Error cargando tick sound:', e);
            }
        }
    }

    function playTick() {
        if (!tickSound) return;
        try {
            tickSound.currentTime = 0;
            const p = tickSound.play();
            if (p && p.catch) p.catch(function () { });
        } catch (e) { }
    }

    function playQuestionAudio(url) {
        if (!url) return;

        if (questionAudio) {
            try {
                questionAudio.pause();
                questionAudio.currentTime = 0;
            } catch (e) { }
            questionAudio = null;
        }

        setTimeout(function () {
            try {
                questionAudio = document.getElementById('question-audio-player');
                if (questionAudio) {
                    questionAudio.load();
                    const playPromise = questionAudio.play();

                    if (playPromise && playPromise.then) {
                        playPromise.then(function () {
                            console.log('Audio reproduciendo correctamente');
                        }).catch(function (error) {
                            console.log('Error al reproducir audio:', error);
                            setTimeout(function () {
                                try {
                                    if (questionAudio) questionAudio.play();
                                } catch (e) { }
                            }, 500);
                        });
                    }
                }
            } catch (e) {
                console.log('Error iniciando audio:', e);
            }
        }, 200);
    }

    function stopQuestionAudio() {
        if (questionAudio) {
            try {
                questionAudio.pause();
                questionAudio.currentTime = 0;
            } catch (e) { }
        }
    }

    // Helper method added here instead of app code
    function unlockAudioContext() {
        try {
            const unlockAudio = new Audio();
            unlockAudio.src = '/audio/bip.wav';
            unlockAudio.volume = 0.01;
            unlockAudio.play().then(function () {
                unlockAudio.pause();
                unlockAudio.src = '';
            }).catch(function () { });
        } catch (e) { }
    }

    return {
        initAudio: initAudio,
        playTick: playTick,
        playQuestionAudio: playQuestionAudio,
        stopQuestionAudio: stopQuestionAudio,
        unlockAudioContext: unlockAudioContext
    };
})();
