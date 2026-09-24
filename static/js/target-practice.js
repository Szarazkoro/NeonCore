const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');
if(document.getElementById('gameOverScreen')) document.getElementById('gameOverScreen').style.display = 'none';

let rawScore = 0, totalRealXP = 0, pendingRealXP = 0, frameCount = 0, streak = 0, multiplier = 1, targetDecaySpeed = 0.3, targets = [];

function savePendingXP() {
    if (pendingRealXP > 0) {
        let xp = pendingRealXP; pendingRealXP = 0;
        fetch('/api/save_xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_type: "aim", earned_xp: xp }) })
        .then(response => { if (!response.ok) throw new Error('XP save failed'); return response.json(); })
        .then(() => { if(realXpDisplay) { realXpDisplay.innerText = "0 (Mentve)"; setTimeout(() => realXpDisplay.innerText = "0", 2000); } })
        .catch(() => { pendingRealXP += xp; if(realXpDisplay) realXpDisplay.innerText = "Save failed"; });
    }
}

function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) { gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)"; setTimeout(() => gameContainer.style.boxShadow = "none", 200); }
    savePendingXP(); streak = 0; multiplier = 1; targetDecaySpeed = 0.3; frameCount = 0;
    rawScore = Math.max(totalRealXP * 100, rawScore - 15);
    updateUI();
}

function addScore(points) {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 11)); targetDecaySpeed = Math.min(0.65, targetDecaySpeed + 0.01); rawScore += points * multiplier;
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

function spawnTarget() {
    targets.push({ x: Math.random() * (canvas.width - 60) + 30, y: Math.random() * (canvas.height - 150) + 100, radius: 40, color: '#ff4757' });
}

canvas.addEventListener('pointerdown', (e) => {
    if(e.target && e.target.tagName === 'A') return;
    const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    for (let i = targets.length - 1; i >= 0; i--) {
        if (Math.hypot(mouseX - targets[i].x, mouseY - targets[i].y) <= targets[i].radius) {
            targets.splice(i, 1); addScore(7); return; // Eltalálta
        }
    }
    breakCombo(); // Mellékattintott
});

function update() {
    frameCount++;
    if (frameCount % Math.max(30, 80 - Math.floor(frameCount / 100)) === 0) spawnTarget();

    for (let i = targets.length - 1; i >= 0; i--) {
        targets[i].radius -= targetDecaySpeed;
        if (targets[i].radius <= 5) { targets.splice(i, 1); breakCombo(); } // Eltűnt (nem kattintott)
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    targets.forEach(t => {
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 71, 87, 0.2)'; ctx.fill();
        ctx.strokeStyle = t.color; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    });
    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; ctx.font = 'bold 40px Courier New'; ctx.textAlign = 'center'; ctx.fillText(`x${multiplier}`, canvas.width / 2, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, canvas.width / 2, 105);
    }
}
function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();