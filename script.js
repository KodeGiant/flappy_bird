const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCDvc14LKKWbFtMxVucBMcVxbKY_mMgAlc",
    authDomain: "flappy-bird-cc12a.firebaseapp.com",
    databaseURL: "https://flappy-bird-cc12a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "flappy-bird-cc12a",
    storageBucket: "flappy-bird-cc12a.firebasestorage.app",
    messagingSenderId: "292128610728",
    appId: "1:292128610728:web:640d038741a0bff4fee59d"
};

// Initialize Firebase
let firebaseInitialized = false;
let database = null;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseInitialized = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase initialization failed, using localStorage only:', error);
}

// UI Elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('scoreDisplay');
const currentScoreEl = document.getElementById('currentScore');
const bestScoreEl = document.getElementById('bestScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const persistentBestValue = document.getElementById('persistentBestValue');
const nameInputModal = document.getElementById('nameInputModal');
const playerNameInput = document.getElementById('playerName');
const submitNameBtn = document.getElementById('submitNameBtn');
const newHighScoreEl = document.getElementById('newHighScore');
const startLeaderboard = document.getElementById('startLeaderboard');
const gameOverLeaderboard = document.getElementById('gameOverLeaderboard');

// Audio
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

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

// Game State
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('flappy_best_score') || 0;
let gameState = 'START'; // START, PLAYING, GAMEOVER, ENTERING_NAME
let gameSpeed = 3;
let pendingScore = 0; // Score waiting to be saved with name

// Leaderboard
const MAX_LEADERBOARD_ENTRIES = 10;
let cachedLeaderboard = [];

// Get leaderboard from localStorage (fallback/cache)
function getLocalLeaderboard() {
    const data = localStorage.getItem('flappy_leaderboard');
    return data ? JSON.parse(data) : [];
}

// Save leaderboard to localStorage
function saveLocalLeaderboard(leaderboard) {
    localStorage.setItem('flappy_leaderboard', JSON.stringify(leaderboard));
}

// Fetch leaderboard from Firebase
async function fetchLeaderboardFromFirebase() {
    if (!firebaseInitialized) {
        return getLocalLeaderboard();
    }

    try {
        const snapshot = await database.ref('leaderboard').orderByChild('score').limitToLast(MAX_LEADERBOARD_ENTRIES).once('value');
        const data = snapshot.val();
        if (!data) return [];

        const leaderboard = Object.values(data).sort((a, b) => b.score - a.score);
        // Update local cache
        saveLocalLeaderboard(leaderboard);
        cachedLeaderboard = leaderboard;
        return leaderboard;
    } catch (error) {
        console.warn('Failed to fetch from Firebase, using local cache:', error);
        return getLocalLeaderboard();
    }
}

// Get current leaderboard (cached)
function getLeaderboard() {
    return cachedLeaderboard.length > 0 ? cachedLeaderboard : getLocalLeaderboard();
}

// Check if score qualifies for top 10
function isTopScore(newScore) {
    if (newScore <= 0) return false;
    const leaderboard = getLeaderboard();
    if (leaderboard.length < MAX_LEADERBOARD_ENTRIES) return true;
    return newScore > leaderboard[leaderboard.length - 1].score;
}

// Add score to leaderboard (Firebase + localStorage)
async function addToLeaderboard(name, newScore) {
    const entry = {
        name: name.toUpperCase(),
        score: newScore,
        timestamp: Date.now()
    };

    // Always save locally first
    let leaderboard = getLocalLeaderboard();
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > MAX_LEADERBOARD_ENTRIES) {
        leaderboard.length = MAX_LEADERBOARD_ENTRIES;
    }
    saveLocalLeaderboard(leaderboard);
    cachedLeaderboard = leaderboard;

    // Try to save to Firebase (with timeout)
    if (firebaseInitialized) {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firebase timeout')), 5000)
            );
            const savePromise = database.ref('leaderboard').push(entry);
            await Promise.race([savePromise, timeoutPromise]);
            // Refresh from Firebase to get accurate global leaderboard
            await Promise.race([fetchLeaderboardFromFirebase(), timeoutPromise]);
        } catch (error) {
            console.warn('Failed to save to Firebase:', error);
        }
    }

    return getLeaderboard();
}

// Render leaderboard to container
function renderLeaderboard(container, highlightScore = null) {
    const leaderboard = getLeaderboard();

    if (leaderboard.length === 0) {
        container.innerHTML = `
            <div class="leaderboard-title">Top 10</div>
            <div class="leaderboard-empty">No scores yet. Be the first!</div>
        `;
        return;
    }

    let html = '<div class="leaderboard-title">Top 10</div>';
    leaderboard.forEach((entry, index) => {
        const isHighlight = highlightScore !== null && entry.score === highlightScore;
        html += `
            <div class="leaderboard-entry${isHighlight ? ' highlight' : ''}">
                <span class="leaderboard-rank">${index + 1}.</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-score">${entry.score}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Async render that fetches fresh data from Firebase
async function renderLeaderboardAsync(container, highlightScore = null) {
    // Show loading state
    container.innerHTML = `
        <div class="leaderboard-title">Top 10</div>
        <div class="leaderboard-empty">Loading...</div>
    `;

    await fetchLeaderboardFromFirebase();
    renderLeaderboard(container, highlightScore);
}

// Resize Canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game Objects
const bird = {
    x: 50,
    y: 150,
    w: 30,
    h: 30,
    radius: 15,
    velocity: 0,
    gravity: 0.25,
    jumpStrength: -6,
    rotation: 0,

    draw: function () {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Rotate bird based on velocity
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        ctx.rotate(this.rotation);

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eye
        ctx.beginPath();
        ctx.arc(8, -6, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -6, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        // Wing
        ctx.beginPath();
        ctx.ellipse(-5, 5, 8, 5, 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Beak
        ctx.beginPath();
        ctx.moveTo(8, 2);
        ctx.lineTo(16, 6);
        ctx.lineTo(8, 10);
        ctx.fillStyle = '#FF6B6B';
        ctx.fill();

        ctx.restore();
    },

    update: function () {
        this.velocity += this.gravity;
        this.y += this.velocity;

        // Floor collision
        if (this.y + this.radius >= canvas.height) {
            this.y = canvas.height - this.radius;
            gameOver();
        }

        // Ceiling collision (optional, but good for gameplay)
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    },

    jump: function () {
        this.velocity = this.jumpStrength;
    },

    reset: function () {
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.rotation = 0;
    }
};

const pipes = {
    items: [],
    w: 50,
    gap: 150,
    dx: 3,

    draw: function () {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];

            ctx.fillStyle = '#75C9C8'; // Pipe color

            // Top Pipe
            ctx.fillRect(p.x, 0, this.w, p.top);
            // Pipe Cap
            ctx.fillStyle = '#5DAEAD';
            ctx.fillRect(p.x - 2, p.top - 20, this.w + 4, 20);

            // Bottom Pipe
            ctx.fillStyle = '#75C9C8';
            ctx.fillRect(p.x, canvas.height - p.bottom, this.w, p.bottom);
            // Pipe Cap
            ctx.fillStyle = '#5DAEAD';
            ctx.fillRect(p.x - 2, canvas.height - p.bottom, this.w + 4, 20);
        }
    },

    update: function () {
        // Add new pipe every 100 frames (approx 1.6s at 60fps)
        if (frames % 120 === 0) {
            // Calculate random positions
            // Min pipe height = 50
            let maxTop = canvas.height - this.gap - 50;
            let topHeight = Math.floor(Math.random() * (maxTop - 50 + 1)) + 50;

            this.items.push({
                x: canvas.width,
                top: topHeight,
                bottom: canvas.height - this.gap - topHeight,
                passed: false
            });
        }

        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x -= this.dx;

            // Collision Detection
            // Horizontal check
            if (bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + this.w) {
                // Vertical check
                if (bird.y - bird.radius < p.top || bird.y + bird.radius > canvas.height - p.bottom) {
                    gameOver();
                }
            }

            // Score update
            if (p.x + this.w < bird.x && !p.passed) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;
                // Increase difficulty slightly
                if (score % 5 === 0) this.dx += 0.2;
            }

            // Remove off-screen pipes
            if (p.x + this.w < 0) {
                this.items.shift();
                i--;
            }
        }
    },

    reset: function () {
        this.items = [];
        this.dx = 3;
    }
};

const background = {
    clouds: [],

    draw: function () {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.clouds.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    update: function () {
        if (frames % 60 === 0) {
            this.clouds.push({
                x: canvas.width + 50,
                y: Math.random() * (canvas.height / 2),
                r: Math.random() * 20 + 10,
                speed: Math.random() * 1 + 0.5
            });
        }

        this.clouds.forEach((c, i) => {
            c.x -= c.speed;
            if (c.x < -50) this.clouds.splice(i, 1);
        });
    }
};

// Particle System
const particles = [];

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.color = '#8a0303'; // Blood red
        this.alpha = 1;
        this.gravity = 0.1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.alpha -= 0.02;
        if (this.alpha < 0) this.alpha = 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createBlood(x, y) {
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(x, y));
    }
}

function handleParticles() {
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }
}

// Controls
function jump() {
    if (gameState === 'START') {
        startGame();
        playJumpSound();
    } else if (gameState === 'PLAYING') {
        bird.jump();
        playJumpSound();
    }
}

function startGame() {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    score = 0;
    scoreDisplay.innerText = score;
    bird.reset();
    bird.jump();
    pipes.reset();
    frames = 0;
}

function gameOver() {
    createBlood(bird.x, bird.y);
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappy_best_score', bestScore);
    }
    persistentBestValue.innerText = bestScore;
    scoreDisplay.classList.add('hidden');

    // Check if score qualifies for leaderboard
    if (isTopScore(score)) {
        gameState = 'ENTERING_NAME';
        pendingScore = score;
        newHighScoreEl.innerText = score;
        playerNameInput.value = '';
        nameInputModal.classList.remove('hidden');
        playerNameInput.focus();
    } else {
        gameState = 'GAMEOVER';
        currentScoreEl.innerText = score;
        bestScoreEl.innerText = bestScore;
        renderLeaderboard(gameOverLeaderboard, null);
        gameOverScreen.classList.remove('hidden');
    }
}

function resetGame() {
    gameState = 'START';
    gameOverScreen.classList.add('hidden');
    nameInputModal.classList.add('hidden');
    renderLeaderboardAsync(startLeaderboard);
    startScreen.classList.remove('hidden');
    bird.reset();
    pipes.reset();
    particles.length = 0;
}

async function submitHighScore() {
    let name = playerNameInput.value.trim();
    if (!name) name = 'AAA';

    // Disable button while saving
    submitNameBtn.disabled = true;
    submitNameBtn.innerText = 'SAVING...';

    await addToLeaderboard(name, pendingScore);

    submitNameBtn.disabled = false;
    submitNameBtn.innerText = 'SUBMIT';

    gameState = 'GAMEOVER';
    nameInputModal.classList.add('hidden');
    currentScoreEl.innerText = pendingScore;
    bestScoreEl.innerText = bestScore;
    renderLeaderboard(gameOverLeaderboard, pendingScore);
    gameOverScreen.classList.remove('hidden');
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    background.update();
    background.draw();

    if (gameState === 'PLAYING') {
        pipes.update();
        pipes.draw();
        bird.update();
        bird.draw();
        frames++;
    } else if (gameState === 'START') {
        bird.y = canvas.height / 2 + Math.sin(Date.now() / 300) * 10;
        bird.draw();
    } else if (gameState === 'GAMEOVER' || gameState === 'ENTERING_NAME') {
        pipes.draw();
        bird.draw();
        handleParticles();
    }

    requestAnimationFrame(gameLoop);
}

// Input Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState !== 'ENTERING_NAME') {
        e.preventDefault();
        jump();
    }
});
window.addEventListener('mousedown', (e) => {
    if (gameState !== 'ENTERING_NAME') {
        jump();
    }
});
window.addEventListener('touchstart', (e) => {
    if (gameState !== 'ENTERING_NAME') {
        e.preventDefault(); // prevent scrolling
        jump();
    }
}, { passive: false });

startBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent jump triggering immediately
    startGame();
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
});

submitNameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    submitHighScore();
});

playerNameInput.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
        e.preventDefault();
        submitHighScore();
    }
    e.stopPropagation();
});

// Prevent space from triggering jump while typing name
playerNameInput.addEventListener('keyup', (e) => {
    e.stopPropagation();
});

// Init
bird.reset();
persistentBestValue.innerText = bestScore;
// Load leaderboard from Firebase on startup
renderLeaderboardAsync(startLeaderboard);
gameLoop();
