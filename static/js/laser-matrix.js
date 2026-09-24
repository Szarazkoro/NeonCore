const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');
const gameContainer = document.getElementById('gameContainer');

// Game Over képernyő elrejtése, ha létezik
if(document.getElementById('gameOverScreen')) document.getElementById('gameOverScreen').style.display = 'none';

let rawScore = 0, totalRealXP = 0, frameCount = 0, streak = 0, multiplier = 1;

// Hibrid XP Gyűjtők (Tört számokat is tárolnak a háttérben)
let pendingAim = 0;
let pendingAgility = 0;

// Játékos (Kurzor pozíciója)
let player = { x: canvas.width / 2, y: canvas.height / 2, radius: 6 };
let targets = [];
let lasers = [];

// === HÁTTÉR MENTÉS (Hibrid elosztás) ===
function savePendingXP() {
    // Csak a kerek, egész számokat küldjük el!
    let sendAim = Math.floor(pendingAim);
    let sendAgility = Math.floor(pendingAgility);

    if (sendAim > 0 || sendAgility > 0) {
        // Levonjuk a gyűjtőből azt, amit elküldünk (a töredék pontok megmaradnak!)
        pendingAim -= sendAim;
        pendingAgility -= sendAgility;
        
        fetch('/api/save_xp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                xp_distribution: { aim: sendAim, agility: sendAgility }
            })
        }).then(response => { if (!response.ok) throw new Error('XP save failed'); return response.json(); }).then(() => {
            if(realXpDisplay) {
                let msg = `0 (Mentve: +${sendAim} Célzás`;
                if (sendAgility > 0) msg += `, +${sendAgility} Kitérés`;
                msg += `)`;
                realXpDisplay.innerText = msg;
                setTimeout(() => realXpDisplay.innerText = (Math.floor(pendingAim) + Math.floor(pendingAgility)), 2500);
            }
        }).catch(() => {
            pendingAim += sendAim;
            pendingAgility += sendAgility;
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
    
    savePendingXP();
    
    streak = 0; 
    multiplier = 1;

    frameCount = 0;
    
    rawScore = Math.max(totalRealXP * 100, rawScore - 15); // Büntetés
    updateUI();
}

function addScore(points) {
    streak++; multiplier = Math.min(6, 1 + Math.floor(streak / 16));
    rawScore += points * multiplier;
    
    let diff = Math.floor(rawScore / 100) - totalRealXP;
    if (diff > 0) {
        totalRealXP += diff;
        
        // HIBRID ELOSZTÁS: 70% Aim, 30% Agility
        pendingAim += diff * 0.7;
        pendingAgility += diff * 0.3;
        
        if(xpBarFill) { xpBarFill.style.filter = "brightness(2)"; setTimeout(() => xpBarFill.style.filter = "brightness(1)", 200); }
    }
    updateUI();
}

function updateUI() {
    if(realXpDisplay) realXpDisplay.innerText = Math.floor(pendingAim) + Math.floor(pendingAgility);
    if(rawScoreDisplay) rawScoreDisplay.innerText = (rawScore % 100);
    if(xpBarFill) xpBarFill.style.width = `${(rawScore % 100)}%`;
}

// Egér követése (A játékos)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    player.x = e.clientX - rect.left;
    player.y = e.clientY - rect.top;
});

// Lövés (Kattintás)
canvas.addEventListener('pointerdown', (e) => {
    if(e.target && e.target.tagName === 'A') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    
    let hit = false;
    for (let i = targets.length - 1; i >= 0; i--) {
        if (Math.hypot(mouseX - targets[i].x, mouseY - targets[i].y) <= targets[i].radius) {
            targets.splice(i, 1);
            addScore(8);
            hit = true;
            break; // Egy lövés, egy célpont
        }
    }
    if (!hit) breakCombo(); // Mellékattintás = Kombótörés
});

function spawnTarget() {
    targets.push({ x: Math.random() * (canvas.width - 60) + 30, y: Math.random() * (canvas.height - 60) + 30, radius: 40 });
}

function spawnLaser() {
    // A vászon szélén spawnol
    let spawnX, spawnY;
    if (Math.random() > 0.5) {
        spawnX = Math.random() > 0.5 ? 0 : canvas.width;
        spawnY = Math.random() * canvas.height;
    } else {
        spawnX = Math.random() * canvas.width;
        spawnY = Math.random() > 0.5 ? 0 : canvas.height;
    }
    
    // Kiszámoljuk az irányt a játékos FELÉ
    let angle = Math.atan2(player.y - spawnY, player.x - spawnX);
    let speed = 3 + (frameCount * 0.0005); // Idővel gyorsulnak a lézerek
    
    lasers.push({ x: spawnX, y: spawnY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5 });
}

function update() {
    frameCount++;
    
    // Célpontok spawnolása
    if (frameCount % Math.max(30, 80 - Math.floor(frameCount / 100)) === 0) spawnTarget();
    
    // Lézerek spawnolása
    if (frameCount % Math.max(20, 60 - Math.floor(frameCount / 150)) === 0) spawnLaser();

    // Célpontok zsugorodása
    for (let i = targets.length - 1; i >= 0; i--) {
        targets[i].radius -= 0.25 + (frameCount * 0.0001);
        if (targets[i].radius <= 5) {
            targets.splice(i, 1);
            breakCombo(); // Nem lőtte ki időben
        }
    }

    // Lézerek mozgása és ütközés vizsgálata
    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].x += lasers[i].vx;
        lasers[i].y += lasers[i].vy;
        
        // Ütközés a játékossal (Kerülés)
        if (Math.hypot(player.x - lasers[i].x, player.y - lasers[i].y) < player.radius + lasers[i].radius) {
            breakCombo();
            lasers.splice(i, 1); // Lézer eltűnik
            continue;
        }

        // Kiment a képernyőről
        if (lasers[i].x < 0 || lasers[i].x > canvas.width || lasers[i].y < 0 || lasers[i].y > canvas.height) {
            lasers.splice(i, 1);
            addScore(1); // Apró jutalom egy sikeres kitérésért
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Célpontok (Piros/Fehér)
    targets.forEach(t => {
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 71, 87, 0.2)'; ctx.fill();
        ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    });

    // Lézerek (Izzó piros)
    lasers.forEach(l => {
        ctx.beginPath(); ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2); 
        ctx.fillStyle = '#ff4757'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff4757'; ctx.fill(); ctx.shadowBlur = 0;
    });

    // Játékos Kurzora (Izzó cián)
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff'; ctx.fill(); ctx.shadowBlur = 0;

    // Kombó szöveg
    if (multiplier > 1) { 
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; ctx.font = 'bold 40px Courier New'; 
        ctx.textAlign = 'center'; ctx.fillText(`x${multiplier}`, canvas.width / 2, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Arial'; ctx.fillText(`Streak: ${streak}`, canvas.width / 2, 105);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
window.addEventListener('beforeunload', savePendingXP);
loop();