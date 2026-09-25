const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');

let rawScore = 0, totalRealXP = 0, streak = 0, multiplier = 1, frameCount = 0;
let pendingHealth = 0, pendingTiming = 0;

let barY = canvas.height - 100, barHeight = 80;
let isHolding = false;
let targetY = canvas.height / 2, targetVy = 0;
let difficulty = 0.05;

function savePendingXP() {
    let sHealth = Math.floor(pendingHealth), sTim = Math.floor(pendingTiming);
    if (sHealth > 0 || sTim > 0) {
        pendingHealth -= sHealth; pendingTiming -= sTim;
        fetch('/api/save_xp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ xp_distribution: { health: sHealth, timing: sTim } })
                }).then(response => { if (!response.ok) throw new Error('XP save failed'); return response.json(); })
                    .then(() => updateUI())
                    .catch(() => {
                            pendingHealth += sHealth;
                            pendingTiming += sTim;
                            updateUI();
                    });
    }
}

function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) { gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)"; setTimeout(() => gameContainer.style.boxShadow = "none", 200); }
    savePendingXP(); streak = 0; multiplier = 1; difficulty = 0.05; frameCount = 0;
    rawScore = Math.max(totalRealXP * 100, rawScore - 5);
    updateUI();
}

function addScore() {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 75)); // Itt a frame-ek miatt lassabban nő a szorzó
    rawScore += 0.7 * multiplier;
    let diff = Math.floor(rawScore / 100) - totalRealXP;
    if (diff > 0) {
        totalRealXP += diff; pendingHealth += diff * 0.6; pendingTiming += diff * 0.4; // 60-40 elosztás
        if(xpBarFill) { xpBarFill.style.filter = "brightness(2)"; setTimeout(() => xpBarFill.style.filter = "brightness(1)", 200); }
    }
    updateUI();
}

function updateUI() {
    if(realXpDisplay) realXpDisplay.innerText = Math.floor(pendingHealth) + Math.floor(pendingTiming);
    const visibleScore = Math.round(rawScore % 100);
    if(rawScoreDisplay) rawScoreDisplay.innerText = visibleScore;
    if(xpBarFill) xpBarFill.style.width = `${visibleScore}%`;
}

// Bemenet kezelés (Egér gomb vagy Space)
window.addEventListener('mousedown', () => isHolding = true);
window.addEventListener('mouseup', () => isHolding = false);
window.addEventListener('keydown', (e) => { if(e.code==='Space'){ e.preventDefault(); isHolding = true;} });
window.addEventListener('keyup', (e) => { if(e.code==='Space') isHolding = false; });

function update() {
    frameCount++;
    
    // Zóna mozgatása (Gravitáció vs Emelkedés)
    if (isHolding) { barY -= 6; } else { barY += 4; }
    if (barY < 0) barY = 0;
    if (barY + barHeight > canvas.height) barY = canvas.height - barHeight;

    // Anomália (Célpont) vad mozgása
    if (frameCount % 30 === 0) {
        targetVy += (Math.random() - 0.5) * 20; // Véletlenszerű rántás
        difficulty += 0.001; // Szépen lassan nehezedik
    }
    targetVy += (Math.random() - 0.5) * difficulty; // Folyamatos mikro-rángás
    targetVy *= 0.95; // Súrlódás
    targetY += targetVy;
    
    if (targetY < 20) { targetY = 20; targetVy *= -1; }
    if (targetY > canvas.height - 20) { targetY = canvas.height - 20; targetVy *= -1; }

    // Benne van a zónában?
    if (targetY > barY && targetY < barY + barHeight) {
        addScore(); // Frame-enként ad egy pici pontot
    } else {
        rawScore = Math.max(totalRealXP * 100, rawScore - 0.1);
        if(streak > 0) breakCombo();
        updateUI();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Középső oszlop rajzolása
    let colX = canvas.width / 2 - 25;
    ctx.fillStyle = '#111'; ctx.fillRect(colX, 0, 50, canvas.height);
    
    // Zöld biztonsági zóna
    ctx.fillStyle = streak > 0 ? 'rgba(46, 160, 67, 0.5)' : 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(colX, barY, 50, barHeight);
    ctx.strokeStyle = '#2ea043'; ctx.lineWidth = 2; ctx.strokeRect(colX, barY, 50, barHeight);

    // Anomália (Célpont)
    ctx.beginPath(); ctx.arc(colX + 25, targetY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4757'; ctx.fill();

    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, 0.8)`; ctx.font = 'bold 30px Courier New'; ctx.textAlign='center'; ctx.fillText(`x${multiplier}`, 60, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, 60, 105);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();