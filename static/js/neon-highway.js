const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');

let rawScore = 0, totalRealXP = 0, frameCount = 0, streak = 0, multiplier = 1;
let pendingAgility = 0, pendingDefense = 0;

let playerLane = 1; // 0: Bal, 1: Közép, 2: Jobb
let speed = 4;
let objects = [];
const laneWidth = canvas.width / 3;

function savePendingXP() {
    let sAgility = Math.floor(pendingAgility), sDefense = Math.floor(pendingDefense);
    if (sAgility > 0 || sDefense > 0) {
        pendingAgility -= sAgility; pendingDefense -= sDefense;
        fetch('/api/save_xp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xp_distribution: { agility: sAgility, defense: sDefense } })
        }).then(() => {
            if(realXpDisplay) {
                realXpDisplay.innerText = `0 (Mentve: +${sAgility} Kitérés, +${sDefense} Pajzs)`;
                setTimeout(() => updateUI(), 2500);
            }
        }).catch(() => {
            pendingAgility += sAgility;
            pendingDefense += sDefense;
            if (realXpDisplay) realXpDisplay.innerText = "Save failed";
        });
    }
}

function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) {
        gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)";
        setTimeout(() => gameContainer.style.boxShadow = "none", 200);
    }
    savePendingXP(); streak = 0; multiplier = 1;
    speed = 4; frameCount = 0;
    rawScore = Math.max(totalRealXP * 100, rawScore - 15);
    updateUI();
}

function addScore(points) {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 11)); rawScore += points * multiplier;
    let diff = Math.floor(rawScore / 100) - totalRealXP;
    if (diff > 0) {
        totalRealXP += diff; 
        pendingAgility += diff * 0.7; pendingDefense += diff * 0.3; // 70-30 elosztás
        if(xpBarFill) { xpBarFill.style.filter = "brightness(2)"; setTimeout(() => xpBarFill.style.filter = "brightness(1)", 200); }
    }
    updateUI();
}

function updateUI() {
    if(realXpDisplay) realXpDisplay.innerText = Math.floor(pendingAgility) + Math.floor(pendingDefense);
    if(rawScoreDisplay) rawScoreDisplay.innerText = (rawScore % 100);
    if(xpBarFill) xpBarFill.style.width = `${(rawScore % 100)}%`;
}

// Irányítás (A/D vagy Nyilak)
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { playerLane = Math.max(0, playerLane - 1); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { playerLane = Math.min(2, playerLane + 1); }
});

canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    playerLane = Math.max(0, Math.min(2, Math.floor((e.clientX - rect.left) / (rect.width / 3))));
});

function spawnObject() {
    let lane = Math.floor(Math.random() * 3);
    let isBad = Math.random() > 0.4; // 60% piros, 40% zöld
    objects.push({ lane: lane, y: -40, isBad: isBad });
}

function update() {
    frameCount++;
    if (frameCount % 600 === 0) speed += 0.5;
    
    if (frameCount % Math.max(20, 70 - Math.floor(speed * 3)) === 0) spawnObject();

    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        obj.y += speed;

        // Ütközés
        if (obj.y > canvas.height - 100 && obj.y < canvas.height - 40 && obj.lane === playerLane) {
            if (obj.isBad) { breakCombo(); } 
            else { addScore(5); }
            objects.splice(i, 1);
            continue;
        }

        // Kiment a képernyőről
        if (obj.y > canvas.height) {
            if (!obj.isBad) { breakCombo(); } // Zöldet hagyott ki
            objects.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sávok rajzolása
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(laneWidth, 0); ctx.lineTo(laneWidth, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(laneWidth * 2, 0); ctx.lineTo(laneWidth * 2, canvas.height); ctx.stroke();

    // Játékos (Űrhajó/Karakter)
    let px = (playerLane * laneWidth) + (laneWidth / 2);
    ctx.fillStyle = '#66fcf1'; ctx.shadowBlur = 15; ctx.shadowColor = '#66fcf1';
    ctx.beginPath(); ctx.arc(px, canvas.height - 70, 20, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

    // Tárgyak
    objects.forEach(obj => {
        let ox = (obj.lane * laneWidth) + (laneWidth / 2);
        ctx.fillStyle = obj.isBad ? '#ff4757' : '#2ea043';
        ctx.fillRect(ox - 15, obj.y, 30, 30);
    });

    if (multiplier > 1) { 
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; ctx.font = 'bold 40px Courier New'; 
        ctx.textAlign = 'center'; ctx.fillText(`x${multiplier}`, canvas.width / 2, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, canvas.width / 2, 105);
    }
}
function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();