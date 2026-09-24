const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');
if(document.getElementById('gameOverScreen')) document.getElementById('gameOverScreen').style.display = 'none';

let rawScore = 0, totalRealXP = 0, pendingRealXP = 0, frameCount = 0, streak = 0, multiplier = 1;
const cx = canvas.width / 2, cy = canvas.height / 2;
let shieldAngle = 0, shieldDirection = 1, shieldRadius = 75, coreRadius = 25, shieldSize = 18;
let enemies = [], particles = [], difficultyMultiplier = 1, lastSpawnAngle = Math.random() * Math.PI * 2;

function savePendingXP() {
    if (pendingRealXP > 0) {
        let xp = pendingRealXP; pendingRealXP = 0;
        fetch('/api/save_xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_type: "defense", earned_xp: xp }) })
        .then(response => { if (!response.ok) throw new Error('XP save failed'); return response.json(); })
        .then(() => { if(realXpDisplay) { realXpDisplay.innerText = "0 (Mentve)"; setTimeout(() => realXpDisplay.innerText = "0", 2000); } })
        .catch(() => { pendingRealXP += xp; if(realXpDisplay) realXpDisplay.innerText = "Save failed"; });
    }
}

function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) { gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)"; setTimeout(() => gameContainer.style.boxShadow = "none", 200); }
    savePendingXP();
    streak = 0; multiplier = 1; difficultyMultiplier = 1; frameCount = 0;
    rawScore = Math.max(totalRealXP * 100, rawScore - 8);
    updateUI();
}

function addScore(points) {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 5)); rawScore += points * multiplier;
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

function switchDirection(e) {
    if(e.target && e.target.tagName === 'A') return;
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault(); 
    shieldDirection *= -1;
}
window.addEventListener('pointerdown', switchDirection);
window.addEventListener('keydown', switchDirection);

function spawnEnemy() {
    lastSpawnAngle += (Math.random() * 2 - 1) * (Math.PI * 0.65); 
    const speed = (1.0 + Math.random() * 1.0) * difficultyMultiplier;
    enemies.push({ x: cx + Math.cos(lastSpawnAngle) * 400, y: cy + Math.sin(lastSpawnAngle) * 400, vx: -Math.cos(lastSpawnAngle) * speed, vy: -Math.sin(lastSpawnAngle) * speed, radius: 8, color: '#ff0055' });
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 1, color: color });
}

function update() {
    frameCount++; if (frameCount % 600 === 0) difficultyMultiplier += 0.15;
    shieldAngle += 0.05 * shieldDirection; 
    const sx = cx + Math.cos(shieldAngle) * shieldRadius, sy = cy + Math.sin(shieldAngle) * shieldRadius;

    if (frameCount % Math.max(40, 100 - Math.floor(difficultyMultiplier * 10)) === 0) spawnEnemy();

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i]; e.x += e.vx; e.y += e.vy;
        if (Math.hypot(e.x - sx, e.y - sy) < e.radius + shieldSize) { // Védve
            createExplosion(e.x, e.y, '#66fcf1'); enemies.splice(i, 1); addScore(4); continue;
        }
        if (Math.hypot(e.x - cx, e.y - cy) < e.radius + coreRadius) { // Magot érte
            createExplosion(cx, cy, '#ff0055'); enemies.splice(i, 1); breakCombo();
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function draw() {
    ctx.fillStyle = 'rgba(17, 17, 17, 0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pulse = Math.sin(frameCount * 0.1) * 3;
    ctx.beginPath(); ctx.arc(cx, cy, coreRadius + pulse, 0, Math.PI * 2); ctx.fillStyle = '#1f2833'; ctx.strokeStyle = '#66fcf1'; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
    
    const sx = cx + Math.cos(shieldAngle) * shieldRadius, sy = cy + Math.sin(shieldAngle) * shieldRadius;
    ctx.beginPath(); ctx.arc(sx, sy, shieldSize, 0, Math.PI * 2); ctx.fillStyle = '#66fcf1'; ctx.shadowBlur = 15; ctx.shadowColor = '#66fcf1'; ctx.fill(); ctx.shadowBlur = 0; 

    enemies.forEach(e => { ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fillStyle = e.color; ctx.fill(); });
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; 

    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; ctx.font = 'bold 40px Courier New'; ctx.textAlign = 'center'; ctx.fillText(`x${multiplier}`, cx, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, cx, 105);
    }
}
function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();