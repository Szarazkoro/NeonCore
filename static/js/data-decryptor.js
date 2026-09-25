const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');

let rawScore = 0, totalRealXP = 0, streak = 0, multiplier = 1;
let pendingTiming = 0, pendingSuper = 0;

let sequence = [];
let currentIndex = 0;
let timeLeft = 100; // Százalékos sáv (100 -> 0)
let depletionRate = 0.5;
let baseLength = 4;

const ARROWS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function generateSequence() {
    sequence = []; currentIndex = 0; timeLeft = 100;
    let len = baseLength + Math.floor(streak / 3); // Idővel hosszabb kódok
    for(let i=0; i<len; i++) {
        sequence.push(ARROWS[Math.floor(Math.random() * ARROWS.length)]);
    }
}

function savePendingXP() {
    let sTiming = Math.floor(pendingTiming), sSuper = Math.floor(pendingSuper);
    if (sTiming > 0 || sSuper > 0) {
        pendingTiming -= sTiming; pendingSuper -= sSuper;
        fetch('/api/save_xp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xp_distribution: { timing: sTiming, super: sSuper } })
        }).then(() => {
            if(realXpDisplay) {
                realXpDisplay.innerText = `0 (Mentve)`;
                setTimeout(() => updateUI(), 1000);
            }
        }).catch(() => {
            pendingTiming += sTiming;
            pendingSuper += sSuper;
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
    savePendingXP(); streak = 0; multiplier = 1; depletionRate = 0.5; baseLength = 4;
    rawScore = Math.max(totalRealXP * 100, rawScore - 10);
    generateSequence(); updateUI();
}

function addScore(points) {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 4)); rawScore += points * multiplier;
    depletionRate += 0.04; // Egyre gyorsabban telik az idő
    
    let diff = Math.floor(rawScore / 100) - totalRealXP;
    if (diff > 0) {
        totalRealXP += diff; 
        pendingTiming += diff * 0.6; pendingSuper += diff * 0.4; // 60% Timing, 40% Super
        if(xpBarFill) { xpBarFill.style.filter = "brightness(2)"; setTimeout(() => xpBarFill.style.filter = "brightness(1)", 200); }
    }
    generateSequence(); updateUI();
}

function updateUI() {
    if(realXpDisplay) realXpDisplay.innerText = Math.floor(pendingTiming) + Math.floor(pendingSuper);
    if(rawScoreDisplay) rawScoreDisplay.innerText = (rawScore % 100);
    if(xpBarFill) xpBarFill.style.width = `${(rawScore % 100)}%`;
}

window.addEventListener('keydown', (e) => {
    let input = null;
    if(e.code === 'ArrowUp' || e.code === 'KeyW') input = 'UP';
    if(e.code === 'ArrowDown' || e.code === 'KeyS') input = 'DOWN';
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') input = 'LEFT';
    if(e.code === 'ArrowRight' || e.code === 'KeyD') input = 'RIGHT';
    
    if(!input) return;
    e.preventDefault();

    if(input === sequence[currentIndex]) {
        currentIndex++;
        if(currentIndex >= sequence.length) addScore(15); // Teljes kód megfejtve
    } else {
        breakCombo(); // Rossz gomb!
    }
});

let touchStart = null;
canvas.addEventListener('pointerdown', (e) => {
    touchStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    const input = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'RIGHT' : 'LEFT')
        : (dy > 0 ? 'DOWN' : 'UP');
    if (input === sequence[currentIndex]) {
        currentIndex++;
        if (currentIndex >= sequence.length) addScore(15);
    } else {
        breakCombo();
    }
});

function update() {
    timeLeft -= depletionRate;
    if (timeLeft <= 0) breakCombo(); // Lejárt az idő!
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Idősáv rajzolása
    ctx.fillStyle = '#333'; ctx.fillRect(20, 40, canvas.width - 40, 20);
    ctx.fillStyle = timeLeft > 30 ? '#00e5ff' : '#ff4757';
    ctx.fillRect(20, 40, (canvas.width - 40) * (timeLeft / 100), 20);

    // Kód kirajzolása
    const symbolMap = { 'UP': '⬆️', 'DOWN': '⬇️', 'LEFT': '⬅️', 'RIGHT': '➡️' };
    ctx.font = '40px Arial'; ctx.textAlign = 'center';
    
    let startY = 150;
    for(let i=0; i<sequence.length; i++) {
        let x = canvas.width / 2;
        let y = startY + (i * 60);
        
        if (i < currentIndex) {
            ctx.globalAlpha = 0.3; // Már beütött gombok elhalványulnak
        } else if (i === currentIndex) {
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 15; ctx.shadowColor = '#f1c40f'; // Aktuális gomb izzik
        } else {
            ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
        }
        ctx.fillText(symbolMap[sequence[i]], x, y);
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;

    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, 0.8)`; ctx.font = 'bold 30px Courier New'; ctx.textAlign = 'center'; ctx.fillText(`x${multiplier}`, canvas.width/2, canvas.height - 50);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, canvas.width/2, canvas.height - 25);
    }
}

generateSequence();
function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();