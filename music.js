// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Background Music State
let bgMusicPlaying = false;
let bgMusicInterval = null;
let currentNote = 0;

// Music tracks configuration
const musicTracks = {
    classic: {
        name: 'Classic',
        tempo: 140,
        melodyType: 'square',
        bassType: 'triangle',
        melodyVolume: 0.06,
        bassVolume: 0.1,
        melody: [
            330, 330, 0, 330, 0, 262, 330, 0, 392, 0, 0, 0, 196, 0, 0, 0,
            262, 0, 0, 196, 0, 0, 165, 0, 0, 220, 0, 247, 0, 233, 220, 0,
            196, 330, 392, 440, 0, 349, 392, 0, 330, 0, 262, 294, 247, 0, 0, 0
        ],
        bass: [
            131, 131, 131, 131, 165, 165, 165, 165, 196, 196, 196, 196, 98, 98, 98, 98,
            131, 131, 131, 98, 98, 98, 82, 82, 82, 110, 110, 123, 123, 117, 110, 110,
            98, 165, 196, 220, 220, 175, 196, 196, 165, 165, 131, 147, 123, 123, 123, 123
        ]
    },
    retro: {
        name: 'Retro Wave',
        tempo: 120,
        melodyType: 'sawtooth',
        bassType: 'square',
        melodyVolume: 0.05,
        bassVolume: 0.08,
        melody: [
            440, 0, 523, 0, 587, 0, 523, 0, 440, 0, 392, 0, 349, 0, 392, 0,
            440, 440, 0, 523, 523, 0, 587, 587, 0, 659, 0, 587, 0, 523, 0, 0,
            392, 0, 440, 0, 523, 0, 587, 0, 659, 0, 587, 0, 523, 0, 440, 0
        ],
        bass: [
            110, 110, 110, 110, 131, 131, 131, 131, 147, 147, 147, 147, 131, 131, 131, 131,
            110, 110, 110, 110, 131, 131, 131, 131, 147, 147, 147, 147, 165, 165, 165, 165,
            98, 98, 98, 98, 110, 110, 110, 110, 131, 131, 131, 131, 147, 147, 147, 147
        ]
    },
    chill: {
        name: 'Chill',
        tempo: 90,
        melodyType: 'sine',
        bassType: 'triangle',
        melodyVolume: 0.07,
        bassVolume: 0.06,
        melody: [
            262, 0, 0, 330, 0, 0, 392, 0, 0, 0, 330, 0, 0, 0, 0, 0,
            294, 0, 0, 349, 0, 0, 440, 0, 0, 0, 392, 0, 0, 0, 0, 0,
            330, 0, 0, 392, 0, 0, 494, 0, 0, 0, 440, 0, 392, 0, 330, 0
        ],
        bass: [
            131, 0, 131, 0, 131, 0, 131, 0, 147, 0, 147, 0, 147, 0, 147, 0,
            165, 0, 165, 0, 165, 0, 165, 0, 196, 0, 196, 0, 196, 0, 196, 0,
            131, 0, 131, 0, 147, 0, 147, 0, 165, 0, 165, 0, 131, 0, 131, 0
        ]
    },
    intense: {
        name: 'Intense',
        tempo: 180,
        melodyType: 'square',
        bassType: 'sawtooth',
        melodyVolume: 0.05,
        bassVolume: 0.07,
        melody: [
            523, 523, 587, 587, 659, 659, 587, 587, 523, 523, 494, 494, 440, 440, 494, 494,
            523, 0, 659, 0, 784, 0, 659, 0, 523, 0, 659, 0, 784, 0, 880, 0,
            880, 784, 659, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 523, 587, 659
        ],
        bass: [
            131, 131, 131, 131, 147, 147, 147, 147, 165, 165, 165, 165, 147, 147, 147, 147,
            131, 0, 165, 0, 196, 0, 165, 0, 131, 0, 165, 0, 196, 0, 220, 0,
            220, 196, 165, 131, 123, 110, 98, 87, 82, 87, 98, 110, 123, 131, 147, 165
        ]
    },
    coconut: {
        name: 'Coconut',
        tempo: 125,
        melodyType: 'sine',
        bassType: 'triangle',
        melodyVolume: 0.07,
        bassVolume: 0.08,
        melody: [
            392, 0, 440, 392, 0, 330, 392, 0, 440, 0, 523, 0, 440, 392, 0, 0,
            392, 0, 440, 392, 0, 330, 294, 0, 330, 0, 392, 0, 330, 294, 0, 0,
            262, 0, 294, 330, 0, 392, 440, 0, 392, 0, 330, 0, 294, 262, 0, 0,
            294, 0, 330, 294, 0, 262, 247, 0, 262, 0, 294, 0, 330, 392, 0, 0
        ],
        bass: [
            196, 0, 196, 0, 247, 0, 247, 0, 262, 0, 262, 0, 247, 0, 247, 0,
            196, 0, 196, 0, 247, 0, 247, 0, 165, 0, 165, 0, 196, 0, 196, 0,
            131, 0, 131, 0, 165, 0, 165, 0, 196, 0, 196, 0, 165, 0, 165, 0,
            147, 0, 147, 0, 131, 0, 131, 0, 147, 0, 147, 0, 196, 0, 196, 0
        ]
    },
    phonk: {
        name: 'Phonk',
        tempo: 130,
        melodyType: 'square',
        bassType: 'sawtooth',
        melodyVolume: 0.05,
        bassVolume: 0.15,
        melody: [
            587, 0, 0, 0, 523, 0, 587, 0, 0, 0, 698, 0, 0, 0, 587, 0,
            554, 0, 0, 0, 494, 0, 554, 0, 0, 0, 659, 0, 0, 0, 554, 0,
            523, 0, 0, 0, 466, 0, 523, 0, 0, 0, 622, 0, 0, 0, 523, 0,
            494, 0, 0, 0, 440, 0, 494, 0, 0, 0, 587, 0, 554, 0, 523, 0
        ],
        bass: [
            55, 0, 55, 0, 0, 0, 55, 0, 55, 0, 0, 0, 55, 0, 0, 0,
            52, 0, 52, 0, 0, 0, 52, 0, 52, 0, 0, 0, 52, 0, 0, 0,
            49, 0, 49, 0, 0, 0, 49, 0, 49, 0, 0, 0, 49, 0, 0, 0,
            46, 0, 46, 0, 0, 0, 52, 0, 55, 0, 0, 0, 55, 0, 55, 0
        ]
    },
    none: {
        name: 'No Music',
        tempo: 0,
        melody: [],
        bass: []
    }
};

let currentTrack = localStorage.getItem('flappy_music_track') || 'classic';

function playNote(frequency, duration, type = 'square', volume = 0.08) {
    if (frequency === 0) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration * 0.9);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playBgMusicNote() {
    if (!bgMusicPlaying) return;

    const track = musicTracks[currentTrack];
    if (!track || track.tempo === 0 || track.melody.length === 0) return;

    const melodyFreq = track.melody[currentNote % track.melody.length];
    const bassFreq = track.bass[currentNote % track.bass.length];
    const beatDuration = 60 / track.tempo;

    playNote(melodyFreq, beatDuration * 0.8, track.melodyType, track.melodyVolume);
    playNote(bassFreq, beatDuration * 0.8, track.bassType, track.bassVolume);

    currentNote++;
}

function startBgMusic() {
    if (bgMusicPlaying) return;

    const track = musicTracks[currentTrack];
    if (!track || track.tempo === 0) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    bgMusicPlaying = true;
    currentNote = 0;
    const beatDuration = 60 / track.tempo;
    bgMusicInterval = setInterval(playBgMusicNote, beatDuration * 1000 / 2);
}

function stopBgMusic() {
    bgMusicPlaying = false;
    if (bgMusicInterval) {
        clearInterval(bgMusicInterval);
        bgMusicInterval = null;
    }
}

function setMusicTrack(trackId) {
    const wasPlaying = bgMusicPlaying;
    stopBgMusic();
    currentTrack = trackId;
    localStorage.setItem('flappy_music_track', trackId);
    updateMusicSelector();
    if (wasPlaying) {
        startBgMusic();
    }
}

function updateMusicSelector() {
    const musicSelector = document.getElementById('musicSelector');
    if (!musicSelector) return;
    const buttons = musicSelector.querySelectorAll('.music-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.track === currentTrack);
    });
}

function initMusicSelector() {
    const musicSelector = document.getElementById('musicSelector');
    if (!musicSelector) return;

    let html = '<label class="music-selector-label" for="musicSelect">Music</label>';
    html += '<select id="musicSelect" class="music-select">';
    for (const [id, track] of Object.entries(musicTracks)) {
        const isSelected = id === currentTrack ? ' selected' : '';
        html += `<option value="${id}"${isSelected}>${track.name}</option>`;
    }
    html += '</select>';
    musicSelector.innerHTML = html;

    // Stop propagation on the entire selector to prevent triggering jump
    musicSelector.addEventListener('mousedown', (e) => e.stopPropagation());
    musicSelector.addEventListener('touchstart', (e) => e.stopPropagation());

    const select = document.getElementById('musicSelect');
    select.addEventListener('change', (e) => {
        e.stopPropagation();
        setMusicTrack(e.target.value);
    });
}

function playJumpSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playCoinSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
}

function playPowerupSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1047, audioCtx.currentTime + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(1568, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.25);
}
