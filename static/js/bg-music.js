const CyberBackgroundMusic = (() => {
    let ctx = null;
    let masterGain = null;
    let sequencerTimer = null;
    let initialized = false;
    let muted = false;
    let beatIndex = Number(sessionStorage.getItem('cyberBgmBeat') || 0);
    let musicVolume = Number(localStorage.getItem('cyberBgmVolume') || 0.7);

    // Sötét kiberpunk akkordmenet (D-moll hangulat: Dm - Bb - F - C)
    const chordProgression = [
        [146.83, 174.61, 220.00, 261.63], // Dm (D, F, A, C)
        [116.54, 139.69, 174.61, 207.65], // Bb (Bb, D, F, A)
        [130.81, 164.81, 196.00, 246.94], // F (F, A, C, E)
        [110.00, 130.81, 164.81, 196.00]  // Am (A, C, E, G)
    ];

    function init() {
        if (initialized) {
            if (ctx && ctx.state === 'suspended') ctx.resume();
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.gain.value = muted ? 0 : musicVolume * 0.35;
        masterGain.connect(ctx.destination);
        initialized = true;

        // Ütemező indítása (~125 BPM tempó)
        sequencerTimer = window.setInterval(onTick, 125);
    }

    // Elektronikus lábdob (Kick) az ütemekhez
    function playKick(time) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);

        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.15);
    }

    // Lüktető fűrészfogas basszus
    function playBass(time, freq) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq / 2, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, time);
        filter.frequency.exponentialRampToValueAtTime(120, time + 0.2);

        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + 0.25);
    }

    // Ritmikus Synthwave Arpeggio (Dallam foszlányok)
    function playArp(time, freq) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq * 2, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, time);
        filter.frequency.exponentialRampToValueAtTime(600, time + 0.18);

        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + 0.2);
    }

    function onTick() {
        if (!ctx || ctx.state !== 'running' || muted) return;
        const now = ctx.currentTime;
        
        const step = beatIndex % 16;
        const bar = Math.floor((beatIndex / 16) % 4);
        const currentChord = chordProgression[bar];

        // Dob minden negyed hangnál
        if (step % 4 === 0) {
            playKick(now);
        }

        // Basszus minden nyolcad hangnál
        if (step % 2 === 0) {
            playBass(now, currentChord[0]);
        }

        // Gyors, futó arpeggio dallam
        const arpNote = currentChord[step % currentChord.length];
        playArp(now, arpNote);

        beatIndex++;
        sessionStorage.setItem('cyberBgmBeat', String(beatIndex));
    }

    function setMuted(nextMuted) {
        muted = nextMuted;
        if (masterGain && ctx) {
            masterGain.gain.setTargetAtTime(muted ? 0 : musicVolume * 0.35, ctx.currentTime, 0.05);
        }
        updateToggle();
    }

    function toggle() {
        init();
        setMuted(!muted);
    }

    function updateToggle() {
        const button = document.getElementById('bgMusicToggle');
        if (!button) return;
        button.textContent = muted ? 'UNMUTE BGM' : 'MUTE BGM';
        button.setAttribute('aria-pressed', String(muted));
    }

    function setVolume(value) {
        musicVolume = Math.max(0, Math.min(1, Number(value)));
        localStorage.setItem('cyberBgmVolume', String(musicVolume));
        if (masterGain && ctx && !muted) {
            masterGain.gain.setTargetAtTime(musicVolume * 0.35, ctx.currentTime, 0.05);
        }
    }

    return { init, toggle, updateToggle, setVolume };
})();

window.CyberBackgroundMusic = CyberBackgroundMusic;

(() => {
    const activateMusic = () => CyberBackgroundMusic.init();

    ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        document.addEventListener(eventName, activateMusic);
    });

    window.addEventListener('load', activateMusic, { once: true });

    document.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('bgMusicToggle');
        if (button) button.addEventListener('click', () => CyberBackgroundMusic.toggle());
        const volumeControl = document.getElementById('bgMusicVolume');
        if (volumeControl) {
            volumeControl.value = String(Math.round(Number(localStorage.getItem('cyberBgmVolume') || 0.7) * 100));
            volumeControl.addEventListener('input', (event) => {
                CyberBackgroundMusic.setVolume(Number(event.target.value) / 100);
            });
        }
        CyberBackgroundMusic.updateToggle();
    });
})();