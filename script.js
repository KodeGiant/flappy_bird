const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('scoreDisplay');
const currentScoreEl = document.getElementById('currentScore');
const bestScoreEl = document.getElementById('bestScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const persistentBestValue = document.getElementById('persistentBestValue');

// Game State
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('flappy_best_score') || 0;
let gameState = 'START'; // START, PLAYING, GAMEOVER
let gameSpeed = 3;

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

// Controls
function jump() {
    if (gameState === 'START') {
        startGame();
    } else if (gameState === 'PLAYING') {
        bird.jump();
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
    gameState = 'GAMEOVER';
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappy_best_score', bestScore);
    }
    currentScoreEl.innerText = score;
    bestScoreEl.innerText = bestScore;
    persistentBestValue.innerText = bestScore;

    scoreDisplay.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

function resetGame() {
    gameState = 'START';
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    bird.reset();
    pipes.reset();
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
    } else if (gameState === 'GAMEOVER') {
        pipes.draw();
        bird.draw();
    }

    requestAnimationFrame(gameLoop);
}

// Input Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') jump();
});
window.addEventListener('mousedown', jump);
window.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent scrolling
    jump();
}, { passive: false });

startBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent jump triggering immediately
    startGame();
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
});

// Init
bird.reset();
persistentBestValue.innerText = bestScore;
gameLoop();
