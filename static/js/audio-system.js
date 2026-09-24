const CyberAudio = (function () {
    let ctx = null;
    let masterGain = null;
    let droneOsc = null;
    let droneGain = null;
    let initialized = false;
    let effectVolume = Number(localStorage.getItem('cyberSfxVolume') || 0.55);

    function init() {
        if (initialized) {
            if (ctx && ctx.state === 'suspended') ctx.resume();
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.gain.value = effectVolume * 0.3;
        masterGain.connect(ctx.destination);
        initialized = true;
    }

    function playTone(freq, type, duration, vol = 1, slide = false) {
        if (!ctx || !masterGain) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;

        osc.type = type;
        osc.connect(gain);
        gain.connect(masterGain);
        osc.frequency.setValueAtTime(freq, now);

        if (slide) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.1), now + duration);
        }

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    }

    function setVolume(value) {
        effectVolume = Math.max(0, Math.min(1, Number(value)));
        localStorage.setItem('cyberSfxVolume', String(effectVolume));
        if (masterGain && ctx) {
            masterGain.gain.setTargetAtTime(effectVolume * 0.3, ctx.currentTime, 0.03);
        }
    }

    function startDrone() {
        if (!ctx || droneOsc) return;

        droneOsc = ctx.createOscillator();
        droneOsc.type = 'sine';
        droneOsc.frequency.value = 55;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 180;

        droneGain = ctx.createGain();
        droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        droneGain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 1.2);

        droneOsc.connect(filter);
        filter.connect(droneGain);
        droneGain.connect(masterGain);
        droneOsc.start();
    }

    function stopDrone() {
        if (!droneOsc) return;
        droneOsc.stop();
        droneOsc.disconnect();
        droneGain.disconnect();
        droneOsc = null;
        droneGain = null;
    }

    return {
        init,
        setVolume,
        getVolume() {
            return effectVolume;
        },
        uiClick() {
            playTone(800, 'square', 0.05, 0.18);
        },
        shoot() {
            playTone(1200, 'sawtooth', 0.15, 0.24, true);
        },
        hit() {
            playTone(150, 'square', 0.2, 0.45, true);
        },
        comboBreak() {
            if (!ctx || !masterGain) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.connect(gain);
            gain.connect(masterGain);
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.4);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        },
        startDrone,
        stopDrone
    };
})();

window.CyberAudio = CyberAudio;

(() => {
    const activateAudio = () => {
        CyberAudio.init();
    };

    ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        document.addEventListener(eventName, activateAudio, { once: true });
    });

    document.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, select')) {
            CyberAudio.init();
            CyberAudio.uiClick();
        }
    });

    document.addEventListener('pointerdown', (event) => {
        if (event.target.closest('canvas')) {
            CyberAudio.init();
            CyberAudio.shoot();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && !event.repeat) {
            CyberAudio.init();
            CyberAudio.shoot();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) activateAudio();
    });
})();
