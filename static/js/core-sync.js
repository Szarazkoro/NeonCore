const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');
if(document.getElementById('gameOverScreen')) document.getElementById('gameOverScreen').style.display = 'none';

let rawScore = 0, totalRealXP = 0, pendingRealXP = 0, streak = 0, multiplier = 1;
let angle = 0, speed = 0.04, markerX = 0, targetZoneWidth = 80;
const cy = canvas.height / 2, targetZoneCenter = canvas.width / 2;

function savePendingXP() {
    if (pendingRealXP > 0) {
        let xp = pendingRealXP; pendingRealXP = 0;
        fetch('/api/save_xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_type: "timing", earned_xp: xp }) })
        .then(response => { if (!response.ok) throw new Error('XP save failed'); return response.json(); })
        .then(() => { if(realXpDisplay) { realXpDisplay.innerText = "0 (Mentve)"; setTimeout(() => realXpDisplay.innerText = "0", 2000); } })
        .catch(() => { pendingRealXP += xp; if(realXpDisplay) realXpDisplay.innerText = "Save failed"; });
    }
}

function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) { gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)"; setTimeout(() => gameContainer.style.boxShadow = "none", 200); }
    savePendingXP(); streak = 0; multiplier = 1;
    speed = 0.04; targetZoneWidth = 80; angle = 0;
    rawScore = Math.max(totalRealXP * 100, rawScore - 15);
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

function checkTiming(e) {
    if(e.target && e.target.tagName === 'A') return;
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault();
    
    if (Math.abs(markerX - targetZoneCenter) < targetZoneWidth / 2) {
        addScore(8); speed += 0.005; targetZoneWidth = Math.max(20, targetZoneWidth - 2); // Sikeres
    } else {
        breakCombo(); // Hiba
    }
}
window.addEventListener('pointerdown', checkTiming);
window.addEventListener('keydown', checkTiming);

function update() { angle += speed; markerX = canvas.width / 2 + Math.sin(angle) * 150; }

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111'; ctx.fillRect(20, cy - 20, canvas.width - 40, 40);
    ctx.fillStyle = 'rgba(241, 196, 15, 0.4)'; ctx.fillRect(targetZoneCenter - targetZoneWidth/2, cy - 20, targetZoneWidth, 40);
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.strokeRect(targetZoneCenter - targetZoneWidth/2, cy - 20, targetZoneWidth, 40);
    ctx.fillStyle = '#fff'; ctx.fillRect(markerX - 5, cy - 30, 10, 60);

    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; ctx.font = 'bold 40px Courier New'; ctx.textAlign = 'center'; ctx.fillText(`x${multiplier}`, canvas.width / 2, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, canvas.width / 2, 105);
    }
}
function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();