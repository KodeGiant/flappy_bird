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
const skipNameBtn = document.getElementById('skipNameBtn');
const newHighScoreEl = document.getElementById('newHighScore');
const startLeaderboard = document.getElementById('startLeaderboard');
const gameOverLeaderboard = document.getElementById('gameOverLeaderboard');

// Game State
let frames = 0;
let score = 0;
let lives = 1;
let bestScore = localStorage.getItem('flappy_best_score') || 0;
let gameState = 'START'; // START, PLAYING, GAMEOVER, ENTERING_NAME
let gameSpeed = 3;
let pendingScore = 0; // Score waiting to be saved with name

// Active Powerups
const activePowerups = {
    slowdown: 0,      // frames remaining
    invincibility: 0,
    magnet: 0,
    tiny: 0
};

// Powerup types
const POWERUP_TYPES = {
    slowdown: { color: '#00BFFF', icon: '⏱', duration: 300 },      // 5 seconds at 60fps
    invincibility: { color: '#FFD700', icon: '⭐', duration: 180 }, // 3 seconds
    magnet: { color: '#FF69B4', icon: '🧲', duration: 360 },       // 6 seconds
    tiny: { color: '#90EE90', icon: '🔬', duration: 240 },         // 4 seconds
    extralife: { color: '#FF4444', icon: '❤️', duration: 0 }        // Instant effect
};

// Powerups system
const powerups = {
    items: [],
    size: 18,
    spawnChance: 0.003, // Rarer than coins

    draw: function() {
        this.items.forEach(p => {
            const type = POWERUP_TYPES[p.type];
            ctx.save();
            ctx.translate(p.x, p.y);

            // Pulsing glow effect
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
            ctx.shadowColor = type.color;
            ctx.shadowBlur = 15 * pulse;

            // Powerup body
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fillStyle = type.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Icon
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(type.icon, 0, 0);

            ctx.restore();
        });
    },

    update: function() {
        // Spawn new powerups rarely
        if (Math.random() < this.spawnChance && this.items.length < 2) {
            const types = Object.keys(POWERUP_TYPES);
            const randomType = types[Math.floor(Math.random() * types.length)];
            let lastPipe = pipes.items[pipes.items.length - 1];
            let safeY;
            if (lastPipe && lastPipe.x > canvas.width - 100) {
                let gapTop = lastPipe.top;
                let gapBottom = canvas.height - lastPipe.bottom;
                safeY = gapTop + (gapBottom - gapTop) / 2;
            } else {
                safeY = canvas.height / 2 + (Math.random() - 0.5) * 200;
            }
            this.items.push({
                x: canvas.width + this.size,
                y: safeY,
                type: randomType
            });
        }

        // Move and check powerups
        for (let i = this.items.length - 1; i >= 0; i--) {
            let p = this.items[i];
            p.x -= pipes.dx;

            // Check collision with bird
            let dx = bird.x - p.x;
            let dy = bird.y - p.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            const birdRadius = activePowerups.tiny > 0 ? bird.radius * 0.5 : bird.radius;

            if (distance < birdRadius + this.size) {
                // Powerup collected!
                this.items.splice(i, 1);
                if (p.type === 'extralife') {
                    lives++;
                } else {
                    activePowerups[p.type] = POWERUP_TYPES[p.type].duration;
                }
                playPowerupSound();
                continue;
            }

            // Remove off-screen
            if (p.x + this.size < 0) {
                this.items.splice(i, 1);
            }
        }

        // Decrement active powerup timers
        for (let key in activePowerups) {
            if (activePowerups[key] > 0) activePowerups[key]--;
        }
    },

    reset: function() {
        this.items = [];
        for (let key in activePowerups) {
            activePowerups[key] = 0;
        }
    }
};

// Coins
const coins = {
    items: [],
    size: 15,
    spawnChance: 0.02, // 2% chance per frame to spawn

    draw: function() {
        this.items.forEach(coin => {
            ctx.save();
            ctx.translate(coin.x, coin.y);

            // Coin body (gold circle)
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner circle for depth
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Dollar sign or star
            ctx.fillStyle = '#DAA520';
            ctx.font = `bold ${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);

            ctx.restore();
        });
    },

    update: function() {
        // Spawn new coins in the gap between pipes
        if (Math.random() < this.spawnChance && this.items.length < 5) {
            // Find the most recent pipe to place coin in its gap
            let lastPipe = pipes.items[pipes.items.length - 1];
            let safeY;
            if (lastPipe && lastPipe.x > canvas.width - 100) {
                // Place coin in the pipe gap
                let gapTop = lastPipe.top;
                let gapBottom = canvas.height - lastPipe.bottom;
                safeY = gapTop + (gapBottom - gapTop) / 2;
            } else {
                // No recent pipe, spawn in middle area
                safeY = canvas.height / 2 + (Math.random() - 0.5) * 200;
            }
            this.items.push({
                x: canvas.width + this.size,
                y: safeY
            });
        }

        // Move and check coins
        for (let i = this.items.length - 1; i >= 0; i--) {
            let coin = this.items[i];
            const speed = activePowerups.slowdown > 0 ? pipes.dx * 0.5 : pipes.dx;
            coin.x -= speed;

            // Magnet effect - coins are attracted to bird
            let dx = bird.x - coin.x;
            let dy = bird.y - coin.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (activePowerups.magnet > 0 && distance < 150) {
                const magnetStrength = 0.15;
                coin.x += dx * magnetStrength;
                coin.y += dy * magnetStrength;
                // Recalculate distance after magnet pull
                dx = bird.x - coin.x;
                dy = bird.y - coin.y;
                distance = Math.sqrt(dx * dx + dy * dy);
            }

            // Check collision with bird
            const hitRadius = activePowerups.tiny > 0 ? bird.radius * 0.5 : bird.radius;
            if (distance < hitRadius + this.size) {
                // Coin collected!
                this.items.splice(i, 1);
                score += 5; // Coins worth 5 points
                scoreDisplay.innerText = score;
                playCoinSound();
                continue;
            }

            // Remove off-screen coins
            if (coin.x + this.size < 0) {
                this.items.splice(i, 1);
            }
        }
    },

    reset: function() {
        this.items = [];
    }
};

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

        // Scale down if tiny powerup is active
        const scale = activePowerups.tiny > 0 ? 0.5 : 1;
        ctx.scale(scale, scale);

        // Invincibility glow effect
        if (activePowerups.invincibility > 0) {
            const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20 + pulse * 10;
        }

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = activePowerups.invincibility > 0 ?
            `hsl(${(Date.now() / 10) % 360}, 100%, 60%)` : '#FFD700';
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

        const hitRadius = activePowerups.tiny > 0 ? this.radius * 0.5 : this.radius;

        // Floor collision (invincibility doesn't help with floor)
        if (this.y + hitRadius >= canvas.height) {
            this.y = canvas.height - hitRadius;
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

    spawnInterval: 350, // Fixed pixel distance between pipes

    spawnPipe: function(x) {
        let maxTop = canvas.height - this.gap - 50;
        let topHeight = Math.floor(Math.random() * (maxTop - 50 + 1)) + 50;
        this.items.push({
            x: x,
            top: topHeight,
            bottom: canvas.height - this.gap - topHeight,
            passed: x < bird.x // Mark as passed if already behind bird
        });
    },

    fillScreen: function() {
        // Pre-fill screen with pipes from bird position to right edge
        const startX = 350; // First pipe position
        for (let x = startX; x < canvas.width + this.spawnInterval; x += this.spawnInterval) {
            this.spawnPipe(x);
        }
    },

    update: function () {
        // Spawn new pipe when last pipe is far enough from right edge
        const lastPipe = this.items[this.items.length - 1];
        const shouldSpawn = !lastPipe || lastPipe.x < canvas.width - this.spawnInterval;

        if (shouldSpawn) {
            this.spawnPipe(canvas.width);
        }

        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            // Slowdown powerup reduces speed by half
            const speed = activePowerups.slowdown > 0 ? this.dx * 0.5 : this.dx;
            p.x -= speed;

            // Collision Detection (skip if invincible)
            if (activePowerups.invincibility <= 0) {
                // Adjust hitbox for tiny powerup
                const hitRadius = activePowerups.tiny > 0 ? bird.radius * 0.5 : bird.radius;
                // Horizontal check
                if (bird.x + hitRadius > p.x && bird.x - hitRadius < p.x + this.w) {
                    // Vertical check
                    if (bird.y - hitRadius < p.top || bird.y + hitRadius > canvas.height - p.bottom) {
                        gameOver();
                    }
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
    pipes.fillScreen(); // Pre-fill screen with pipes
    coins.reset();
    powerups.reset();
    lives = 1;
    frames = 0;
    startBgMusic();
}

function gameOver() {
    createBlood(bird.x, bird.y);
    playDeathSound();

    // Check if we have extra lives
    if (lives > 0) {
        lives--;
        // Give brief invincibility and reset bird position
        activePowerups.invincibility = 120; // 2 seconds of invincibility
        bird.y = canvas.height / 2;
        bird.velocity = 0;
        return;
    }

    stopBgMusic();
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
    coins.reset();
    powerups.reset();
    particles.length = 0;
}

// Bad words filter
const badWords = ['fuck', 'shit', 'ass', 'damn', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'fag', 'nigger', 'nigga', 'whore', 'slut', 'bastard', 'piss', 'crap'];

function containsBadWord(text) {
    const lower = text.toLowerCase();
    return badWords.some(word => lower.includes(word));
}

async function submitHighScore() {
    let name = playerNameInput.value.trim();
    if (!name) name = 'AAA';

    if (containsBadWord(name)) {
        playerNameInput.value = '';
        playerNameInput.placeholder = 'Nice try...';
        playerNameInput.focus();
        return;
    }

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

function skipHighScore() {
    gameState = 'GAMEOVER';
    nameInputModal.classList.add('hidden');
    currentScoreEl.innerText = pendingScore;
    bestScoreEl.innerText = bestScore;
    renderLeaderboard(gameOverLeaderboard, null);
    gameOverScreen.classList.remove('hidden');
}

// Draw active powerup indicators
// Draw lives indicator
function drawLives() {
    ctx.save();
    ctx.font = '20px Arial';
    ctx.fillStyle = '#FF4444';
    ctx.textAlign = 'right';
    const heartsText = '❤️'.repeat(lives + 1); // +1 because lives=1 means 2 total (current + 1 extra)
    ctx.fillText(heartsText, canvas.width - 10, 30);
    ctx.restore();
}

function drawPowerupIndicators() {
    let offsetY = 60;
    for (let key in activePowerups) {
        if (activePowerups[key] > 0) {
            const type = POWERUP_TYPES[key];
            const remaining = activePowerups[key] / type.duration;

            ctx.save();

            // Background bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(10, offsetY, 80, 16);

            // Progress bar
            ctx.fillStyle = type.color;
            ctx.fillRect(10, offsetY, 80 * remaining, 16);

            // Border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(10, offsetY, 80, 16);

            // Icon
            ctx.font = '12px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText(type.icon, 14, offsetY + 13);

            ctx.restore();
            offsetY += 22;
        }
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    background.update();
    background.draw();

    if (gameState === 'PLAYING') {
        pipes.update();
        pipes.draw();
        coins.update();
        coins.draw();
        powerups.update();
        powerups.draw();
        bird.update();
        bird.draw();
        drawPowerupIndicators();
        drawLives();
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

skipNameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    skipHighScore();
});

playerNameInput.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
        e.preventDefault();
        submitHighScore();
    }
    if (e.code === 'Escape') {
        e.preventDefault();
        skipHighScore();
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
initMusicSelector();
// Load leaderboard from Firebase on startup
renderLeaderboardAsync(startLeaderboard);
gameLoop();
