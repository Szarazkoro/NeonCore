const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const gameContainer = document.getElementById('gameContainer');

// UI elemek elrejtése, amikre már nincs szükség
const gameOverScreen = document.getElementById('gameOverScreen');
if(gameOverScreen) gameOverScreen.style.display = 'none';

const rawScoreDisplay = document.getElementById('rawScoreDisplay');
const realXpDisplay = document.getElementById('realXpDisplay');
const xpBarFill = document.getElementById('xpBarFill');

let rawScore = 0;        // A kombókkal egekbe szökő nyers pont
let totalRealXP = 0;     // Hány valódi pontot ért el eddig
let pendingRealXP = 0;   // Mennyit nem küldtünk még el a szervernek

let score = 0;
let pendingXP = 0; // Amit még nem mentettünk el
let frameCount = 0;

// Kombó rendszer
let streak = 0;
let multiplier = 1;

let player = { x: canvas.width / 2, y: canvas.height - 40, w: 70, h: 15 };
let orbs = [];

// Egér/Ujj követése
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    player.x = e.clientX - rect.left - player.w / 2;
});
canvas.addEventListener('touchmove', (e) => {
    const rect = canvas.getBoundingClientRect();
    player.x = e.touches[0].clientX - rect.left - player.w / 2;
    e.preventDefault();
}, {passive: false});

function spawnOrb() {
    let badProbability = Math.min(0.7, 0.15 + (frameCount * 0.0001));
    let isBad = Math.random() < badProbability;
    
    orbs.push({
        x: Math.random() * (canvas.width - 20) + 10,
        y: -20,
        radius: 12,
        isBad: isBad,
        vy: (Math.random() * 2 + 2) + (frameCount * 0.001) 
    });
}

// === HÁTTÉR MENTÉS ===
function savePendingXP() {
    if (pendingRealXP > 0) {
        let xpToSave = pendingRealXP;
        pendingRealXP = 0; // Lenullázzuk
        
        fetch('/api/save_xp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_type: "super", earned_xp: xpToSave })
        }).then(res => { if (!res.ok) throw new Error('XP save failed'); return res.json(); })
          .then(data => {
              console.log(`Mentve: +${xpToSave} Valódi XP!`);
              // Ha elmentettük, a képernyőn lévő "Mentésre vár" szöveget is frissíthetjük
              realXpDisplay.innerText = "0 (Elmentve)";
              setTimeout(() => { realXpDisplay.innerText = "0"; }, 2000);
          })
          .catch(() => {
              pendingRealXP += xpToSave;
              if (realXpDisplay) realXpDisplay.innerText = "Save failed";
          });
    }
}

// === KOMBÓ TÖRÉS LOGIKA ===
function breakCombo() {
    CyberAudio.comboBreak();
    if (streak > 0) {
        // Vizuális visszajelzés a hibáról (képernyő villanás)
        gameContainer.style.boxShadow = "inset 0 0 50px rgba(255, 71, 87, 0.8)";
        setTimeout(() => gameContainer.style.boxShadow = "none", 200);
    }
    
    savePendingXP(); // Hiba esetén azonnal kimentjük az addig szerzett pontot
    
    streak = 0;
    multiplier = 1;
    // Egy picit visszaveszünk a tempóból (de nem teljesen az elejéről indul)
    frameCount = 0;
}

function update() {
    frameCount++;
    let spawnRate = Math.max(15, 40 - Math.floor(frameCount / 150));
    if (frameCount % spawnRate === 0) spawnOrb();
    
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;

    for (let i = orbs.length - 1; i >= 0; i--) {
        let orb = orbs[i];
        orb.y += orb.vy;

        if (orb.y + orb.radius > player.y && orb.x > player.x && orb.x < player.x + player.w) {
            
            if (orb.isBad) {
                breakCombo();
            } else {
                // SIKERES ELKAPÁS
                streak++;
                multiplier = Math.min(6, 1 + Math.floor(streak / 5));
                
                let earnedRaw = 5 * multiplier;
                rawScore += earnedRaw;
                
                // === ÚJ LOGIKA: VALÓDI XP SZÁMÍTÁSA ===
                let newRealXP = Math.floor(rawScore / 100); // Hányszor van meg benne a 100?
                let diff = newRealXP - totalRealXP;         // Léptünk-e át új 100-as határt?
                
                if (diff > 0) {
                    totalRealXP += diff;
                    pendingRealXP += diff;
                    
                    // Látványos felvillanás a sávon, amikor betelik!
                    xpBarFill.style.filter = "brightness(2)";
                    setTimeout(() => xpBarFill.style.filter = "brightness(1)", 200);
                }

                // UI Frissítése
                realXpDisplay.innerText = pendingRealXP;
                rawScoreDisplay.innerText = (rawScore % 100);
                xpBarFill.style.width = `${(rawScore % 100)}%`;
            }
            orbs.splice(i, 1);
            continue;
        }
        
        if (orb.y > canvas.height + 20) {
            if (!orb.isBad) {
                // Büntetés, ha leejt egy kéket: veszít a Nyers pontjából!
                rawScore = Math.max(totalRealXP * 100, rawScore - 10); 
                // Frissítjük a sávot visszefelé is
                rawScoreDisplay.innerText = (rawScore % 100);
                xpBarFill.style.width = `${(rawScore % 100)}%`;
                
                breakCombo();
            }
            orbs.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Játékos lapát
    ctx.fillStyle = '#00e5ff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00e5ff';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.shadowBlur = 0;

    // Gömbök
    orbs.forEach(orb => {
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = orb.isBad ? '#ff4757' : '#00e5ff';
        ctx.fill();
    });

    // === VIZUÁLIS KOMBÓ SZORZÓ ===
    if (multiplier > 1) {
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.min(1, streak * 0.1)})`; // Sárgán izzik
        ctx.font = 'bold 40px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`x${multiplier}`, canvas.width / 2, 80);
        
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '16px Arial';
        ctx.fillText(`Streak: ${streak}`, canvas.width / 2, 105);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Mentés, ha a játékos elnavigál az oldalról (pl. visszamegy a bázisra)
window.addEventListener('beforeunload', savePendingXP);

// Indulás
requestAnimationFrame(gameLoop);