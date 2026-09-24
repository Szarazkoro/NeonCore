const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');
if(document.getElementById('gameOverScreen')) document.getElementById('gameOverScreen').style.display = 'none';

let rawScore = 0, totalRealXP = 0, pendingRealXP = 0;
let frameCount = 0, streak = 0, multiplier = 1, gameSpeed = 5, gravity = 1;
const player = { x: 80, y: 300, size: 24, velocity: 0 };
let obstacles = [];

function savePendingXP() {
    if (pendingRealXP > 0) {
        let xp = pendingRealXP; pendingRealXP = 0;
        fetch('/api/save_xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_type: "agility", earned_xp: xp }) })
        .then(response => { if (!response.ok) throw new Error('XP save failed'); return response.json(); })
        .then(() => { if(realXpDisplay) { realXpDisplay.innerText = "0 (Mentve)"; setTimeout(() => realXpDisplay.innerText = "0", 2000); } })
        .catch(() => { pendingRealXP += xp; if(realXpDisplay) realXpDisplay.innerText = "Save failed"; });
    }
}

function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) { gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)"; setTimeout(() => gameContainer.style.boxShadow = "none", 200); }
    savePendingXP();
    streak = 0; multiplier = 1; gameSpeed = 5; frameCount = 0;
    rawScore = Math.max(totalRealXP * 100, rawScore - 15); // -15 pont büntetés
    updateUI();
}

function addScore(points) {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 11));
    rawScore += points * multiplier;
    let diff = Math.floor(rawScore / 100) - totalRealXP;
    if (diff > 0) {
        totalRealXP += diff; pendingRealXP += diff;
        if(xpBarFill) { xpBarFill.style.filter = "brightness(2)"; setTimeout(() => xpBarFill.style.filter = "brightness(1)", 200); }
    }
    updateUI();
}

function updateUI() {
    if(realXpDisplay) realXpDisplay.innerText = pendingRealXP;
    if(rawScoreDisplay) rawScoreDisplay.innerText = (rawScore % 100);
    if(xpBarFill) xpBarFill.style.width = `${(rawScore % 100)}%`;
}

function switchGravity(e) {
    if(e.target && e.target.tagName === 'A') return;
    if(e.type === 'keydown' && e.code !== 'Space') return;
    if(e.type === 'keydown') e.preventDefault();
    gravity *= -1; player.velocity = gravity * 3; 
}
window.addEventListener('mousedown', switchGravity);
window.addEventListener('keydown', switchGravity);

function spawnObstacle() {
    let h = Math.random() * 200 + 50, y = Math.random() > 0.5 ? 0 : canvas.height - h;
    let isMoving = frameCount > 800 && Math.random() > 0.6;
    obstacles.push({ x: canvas.width, startY: y, y: y, w: 40, h: h, isMoving: isMoving, angle: 0, speed: Math.random() * 0.05 + 0.03 });
}

function update() {
    frameCount++; if (frameCount % 500 === 0) gameSpeed += 0.5;
    player.velocity += gravity * 0.8; player.y += player.velocity;
    if (player.y < 0) { player.y = 0; player.velocity = 0; }
    if (player.y + player.size > canvas.height) { player.y = canvas.height - player.size; player.velocity = 0; }

    if (frameCount % Math.max(35, 80 - Math.floor(gameSpeed * 2)) === 0) spawnObstacle();

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i]; obs.x -= gameSpeed;
        if (obs.isMoving) { obs.angle += obs.speed; obs.y = obs.startY + Math.sin(obs.angle) * 60; }

        if (player.x < obs.x + obs.w && player.x + player.size > obs.x && player.y < obs.y + obs.h && player.y + player.size > obs.y) {
            breakCombo(); obstacles.splice(i, 1); continue; // Ütközés -> Kombó törik, akadály eltűnik
        }
        if (obs.x + obs.w < 0) { addScore(5); obstacles.splice(i, 1); }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00e5ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff';
    ctx.fillRect(player.x, player.y, player.size, player.size); ctx.shadowBlur = 0;
    obstacles.forEach(obs => { ctx.fillStyle = obs.isMoving ? '#ff9f43' : '#ff4757'; ctx.fillRect(obs.x, obs.y, obs.w, obs.h); });

    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; ctx.font = 'bold 40px Courier New'; ctx.textAlign = 'center';
        ctx.fillText(`x${multiplier}`, canvas.width / 2, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial';
        ctx.fillText(`Streak: ${streak}`, canvas.width / 2, 105);
    }
}
function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();