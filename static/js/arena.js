const battleLog = document.getElementById('battleLog');
const heroHpBar = document.getElementById('heroHpBar');
const heroShieldBar = document.getElementById('heroShieldBar');
const enemyHpBar = document.getElementById('enemyHpBar');
const enemyNameDisplay = document.getElementById('enemyNameDisplay');
const btnDefense = document.getElementById('btnDefense');
const shieldStatus = document.getElementById('shieldStatus');
const btnSuper = document.getElementById('btnSuper');
const ultiFill = document.getElementById('ultiFill');
const ultiText = document.getElementById('ultiText');
const heroSprite = document.getElementById('heroSprite');
const enemySprite = document.getElementById('enemySprite');
const postBattlePanel = document.getElementById('postBattlePanel');
const postBattleResult = document.getElementById('postBattleResult');
const btnNextLevel = document.getElementById('btnNextLevel');
const comboDisplay = document.getElementById('comboDisplay');

let player = {};
let enemy = {};
let combatActive = false;
let heroAttackTimer;
let enemyAttackTimer;
let ultiCharge = 0;
let combo = 0;
let audioCtx = null;
let shieldStateTimer;

function ensureAudio() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtor();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone({ frequency = 220, duration = 0.12, type = 'square', volume = 0.04, slide = 0 }) {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    }

    gainNode.gain.setValueAtTime(0.0001, now);
    const effectScale = window.CyberAudio
        ? CyberAudio.getVolume()
        : Number(localStorage.getItem('cyberSfxVolume') || 0.55);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.65 * effectScale, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

function playBattleCue(type) {
    ensureAudio();
    if (!audioCtx) return;

    switch (type) {
        case 'hit':
            playTone({ frequency: 180, duration: 0.08, type: 'square', volume: 0.04, slide: -60 });
            break;
        case 'crit':
            playTone({ frequency: 420, duration: 0.14, type: 'triangle', volume: 0.06, slide: 120 });
            setTimeout(() => playTone({ frequency: 540, duration: 0.12, type: 'triangle', volume: 0.05, slide: 130 }), 40);
            break;
        case 'block':
            playTone({ frequency: 260, duration: 0.12, type: 'sawtooth', volume: 0.04, slide: 40 });
            break;
        case 'ulti':
            playTone({ frequency: 220, duration: 0.14, type: 'sawtooth', volume: 0.06, slide: 160 });
            setTimeout(() => playTone({ frequency: 420, duration: 0.18, type: 'triangle', volume: 0.05, slide: 180 }), 70);
            break;
        case 'win':
            playTone({ frequency: 420, duration: 0.16, type: 'triangle', volume: 0.05, slide: 80 });
            setTimeout(() => playTone({ frequency: 520, duration: 0.18, type: 'triangle', volume: 0.05, slide: 120 }), 120);
            break;
        case 'lose':
            playTone({ frequency: 120, duration: 0.22, type: 'sawtooth', volume: 0.05, slide: -30 });
            break;
        default:
            break;
    }
}

function shakeArena() {
    const arena = document.querySelector('.arena-wrapper');
    if (!arena) return;
    arena.classList.remove('arena-shake');
    void arena.offsetWidth;
    arena.classList.add('arena-shake');
    setTimeout(() => arena.classList.remove('arena-shake'), 220);
}

async function initArena() {
    const response = await fetch('/api/save_xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    const data = await response.json();
    
    player = {
        level: data.new_stats.arena_level,
        maxHp: data.new_stats.stats.health,
        hp: data.new_stats.stats.health,
        maxShield: data.new_stats.stats.shield,
        shield: data.new_stats.stats.shield,
        damage: data.new_stats.stats.damage,
        crit: data.new_stats.stats.crit_chance,
        dodge: data.new_stats.stats.dodge_chance,
        ult: data.new_stats.stats.ultimate,
        isDefending: false
    };

    generateEnemy();
    updateUI();
    startCombat();
}

function generateEnemy() {
    const baseHp = 100 + (player.level * 7) + (player.level / 5) * 50;
    const baseDmg = 8 + (player.level * 3.5) + (player.level / 5) * 8;
    
    if (player.level % 5 === 0) {
        enemy = {
            name: "THE WARDEN (BOSS)", maxHp: baseHp * 2.75, hp: baseHp * 2.75,
            damage: baseDmg * 1.75, speed: 2500, color: "#f1c40f",
            attackPattern: ['heavy', 'pulse', 'standard', 'heavy']
        };
    } else {
        const type = Math.random() > 0.66 ? 'striker' : Math.random() > 0.5 ? 'brute' : 'glitch';
        if (type === 'brute') {
            enemy = {
                name: "THE BRUTE", maxHp: baseHp * 1.95, hp: baseHp * 1.95,
                damage: baseDmg * 1.8, speed: 3600, color: "#e67e22",
                attackPattern: ['heavy', 'standard']
            };
        } else if (type === 'striker') {
            enemy = {
                name: "THE STRIKER", maxHp: baseHp * 1.7, hp: baseHp * 1.7,
                damage: baseDmg * 1.45, speed: 1350, color: "#00e5ff",
                attackPattern: ['standard', 'pulse', 'standard']
            };
        } else {
            enemy = {
                name: "THE GLITCH", maxHp: baseHp * 1.6, hp: baseHp * 1.6,
                damage: baseDmg * 1, speed: 840, color: "#9b59b6",
                attackPattern: ['standard', 'pulse', 'standard', 'pulse']
            };
        }
    }

    enemy.attackIndex = 0;
    
    enemyNameDisplay.innerText = enemy.name;
    enemyNameDisplay.style.color = enemy.color;
    enemySprite.style.boxShadow = `0 0 30px ${enemy.color}`;
    enemySprite.style.backgroundColor = enemy.color;
}

function updateUI() {
    heroHpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    heroShieldBar.style.width = `${Math.max(0, (player.shield / player.maxShield) * 100)}%`;
    enemyHpBar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;

    if (player.shield <= 0 && !player.isDefending && !shieldStateTimer) {
        btnDefense.disabled = true;
        updateShieldStatus('⚠️ SHIELD EMPTY');
    }
}

function updateUltimateCharge() {
    const charge = Math.min(100, Math.max(0, ultiCharge));
    if (ultiFill) ultiFill.style.width = `${charge}%`;

    if (ultiText) {
        ultiText.innerText = charge >= 100 ? '⚡ FIRE ULTIMATE' : `⚡ CHARGING ${Math.round(charge)}%`;
    }

    if (btnSuper) {
        btnSuper.disabled = charge < 100 || !combatActive;
    }
}

function updateCombo() {
    if (!comboDisplay) return;
    comboDisplay.innerText = `COMBO x${combo}`;
    comboDisplay.style.color = combo >= 5 ? '#f1c40f' : '#d2a8ff';
}

function updateShieldStatus(label, seconds = 0) {
    if (!shieldStatus) return;
    shieldStatus.innerText = seconds > 0 ? `${label} ${seconds.toFixed(1)}s` : label;
}

function logMsg(msg, color = "#fff") {
    battleLog.style.color = color;
    battleLog.innerText = msg;
}

function createFloatingText(element, text, type) {
    const el = document.createElement('div');
    el.className = `floating-text text-${type}`;
    el.innerText = text;
    element.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function roundDamage(value) {
    return Math.round(value * 10) / 10;
}

function heroAttack() {
    if (!combatActive) return;

    ensureAudio();
    heroSprite.classList.add('anim-attack-hero');
    setTimeout(() => heroSprite.classList.remove('anim-attack-hero'), 300);

    let dmg = player.damage;
    let isCrit = Math.random() * 100 < player.crit;
    if (isCrit) dmg *= 2;
    dmg = roundDamage(dmg);

    enemy.hp = roundDamage(enemy.hp - dmg);
    combo += 1;
    updateCombo();
    enemySprite.classList.add('anim-hit');
    setTimeout(() => enemySprite.classList.remove('anim-hit'), 200);

    createFloatingText(enemySprite, isCrit ? `CRIT ${dmg}!` : dmg, isCrit ? 'crit' : 'dmg');
    playBattleCue(isCrit ? 'crit' : 'hit');
    shakeArena();

    ultiCharge = Math.min(100, ultiCharge + 12);
    updateUltimateCharge();

    if (enemy.hp <= 0) {
        endCombat(true);
    } else {
        updateUI();
        heroAttackTimer = setTimeout(heroAttack, 1500);
    }
}

function enemyAttack() {
    if (!combatActive) return;

    if (enemy.name.includes('WARDEN') && !enemy.phaseTwo && enemy.hp <= enemy.maxHp * 0.5) {
        enemy.phaseTwo = true;
        enemy.damage = roundDamage(enemy.damage * 1.2);
        enemy.speed = Math.max(1400, enemy.speed - 500);
        enemy.attackPattern = ['heavy', 'pulse', 'heavy', 'standard'];
        enemyNameDisplay.innerText = 'THE WARDEN (PHASE II)';
        enemySprite.style.boxShadow = '0 0 45px #ff4757';
        logMsg('WARDEN PHASE II: CORE OVERRIDE', '#ff4757');
        playBattleCue('ulti');
        shakeArena();
    }

    const attackType = enemy.attackPattern[enemy.attackIndex % enemy.attackPattern.length];
    enemy.attackIndex += 1;
    const attackDelay = attackType === 'heavy' ? 1100 : attackType === 'pulse' ? 550 : 800;
    const attackLabel = attackType === 'heavy' ? 'HEAVY ATTACK' : attackType === 'pulse' ? 'PULSE ATTACK' : 'ATTACK';

    logMsg(`ENEMY ${attackLabel} CHARGING...`, attackType === 'heavy' ? '#f1c40f' : '#ff8a80');
    enemySprite.style.filter = 'brightness(1.6) drop-shadow(0 0 30px #ff4757)';
    enemySprite.style.transform = 'scale(1.08)';
    enemySprite.style.transition = 'all 0.15s ease';
    shakeArena();

    setTimeout(() => {
        if (!combatActive || player.hp <= 0 || enemy.hp <= 0) return;

        enemySprite.style.filter = '';
        enemySprite.style.transform = 'scale(1)';
        enemySprite.classList.add('anim-attack-enemy');
        setTimeout(() => enemySprite.classList.remove('anim-attack-enemy'), 300);

        let isDodged = Math.random() * 100 < player.dodge;

        if (isDodged) {
            createFloatingText(heroSprite, 'DODGED', 'dodge');
            heroSprite.classList.add('status-dodging');
            setTimeout(() => heroSprite.classList.remove('status-dodging'), 300);
            playBattleCue('block');
        } else {
            const damageMultiplier = attackType === 'heavy' ? 1.4 : attackType === 'pulse' ? 0.7 : 1;
            let dmg = roundDamage(enemy.damage * damageMultiplier);
            if (player.isDefending && player.shield > 0) {
                let absorbed = roundDamage(Math.min(player.shield, dmg));
                player.shield = roundDamage(player.shield - absorbed);
                dmg = roundDamage(dmg - absorbed);
                createFloatingText(heroSprite, `BLOCKED ${absorbed}`, 'block');
                playBattleCue('block');
            }

            if (dmg > 0) {
                player.hp = roundDamage(player.hp - dmg);
                combo = 0;
                updateCombo();
                createFloatingText(heroSprite, dmg, 'dmg');
                heroSprite.classList.add('anim-hit');
                setTimeout(() => heroSprite.classList.remove('anim-hit'), 200);
                playBattleCue('hit');
            }
        }

        if (player.hp <= 0) {
            endCombat(false);
        } else {
            updateUI();
            enemyAttackTimer = setTimeout(enemyAttack, enemy.speed);
        }
    }, attackDelay);
}

function startCombat() {
    combatActive = true;
    combo = 0;
    updateCombo();
    logMsg("COMBAT ENGAGED", "#66fcf1");
    heroAttackTimer = setTimeout(heroAttack, 1000);
    enemyAttackTimer = setTimeout(enemyAttack, enemy.speed);
}

function endCombat(victory) {
    combatActive = false;
    clearTimeout(heroAttackTimer);
    clearTimeout(enemyAttackTimer);
    updateUI();
    updateUltimateCharge();

    if (postBattlePanel) postBattlePanel.style.display = 'block';
    if (postBattleResult) {
        postBattleResult.style.color = victory ? '#2ea043' : '#ff4757';
        postBattleResult.innerText = victory ? 'VICTORY! CORE STABLE.' : 'DEFEAT. THE SYSTEM WON THIS ROUND.';
    }

    if (btnNextLevel) {
        btnNextLevel.style.display = victory ? 'inline-block' : 'none';
    }

    if (victory) {
        logMsg('ENEMY TERMINATED. OVERRIDING SYSTEM...', '#2ea043');
        playBattleCue('win');
        fetch('/api/win_arena', { method: 'POST' })
            .then(res => { if (!res.ok) throw new Error('Arena reward failed'); return res.json(); })
            .then(data => {
                if (data.success && postBattleResult) {
                    postBattleResult.innerText = `VICTORY! ARENA LEVEL ${data.new_level} REACHED. +${data.credits} CREDITS`;
                }
            })
            .catch(() => {
                if (postBattleResult) postBattleResult.innerText = 'VICTORY! REWARD SYNC FAILED. PLEASE RETRY.';
            });
    } else {
        logMsg('SYSTEM FAILURE. HERO DEFEATED.', '#ff4757');
        playBattleCue('lose');
    }
}

btnDefense.addEventListener('click', () => {
    ensureAudio();
    if (!combatActive) return;
    if (player.shield <= 0) {
        updateShieldStatus('⚠️ SHIELD EMPTY');
        btnDefense.disabled = true;
        return;
    }
    player.isDefending = true;
    heroSprite.classList.add('status-defending');
    btnDefense.disabled = true;
    updateShieldStatus('🛡️ SHIELD ACTIVE', 3);
    playBattleCue('block');

    setTimeout(() => {
        player.isDefending = false;
        heroSprite.classList.remove('status-defending');
        updateUI();
        const cooldownEnds = performance.now() + 2000;
        updateShieldStatus('⟳ RECHARGING', 2);
        shieldStateTimer = setInterval(() => {
            const remaining = Math.max(0, (cooldownEnds - performance.now()) / 1000);
            updateShieldStatus('⟳ RECHARGING', remaining);
            if (remaining <= 0) {
                clearInterval(shieldStateTimer);
                shieldStateTimer = null;
                if (player.shield > 0 && combatActive) {
                    btnDefense.disabled = false;
                    updateShieldStatus('🛡️ SHIELD READY');
                } else {
                    btnDefense.disabled = true;
                    updateShieldStatus('⚠️ SHIELD EMPTY');
                }
            }
        }, 100);
    }, 3000);
});

btnSuper.addEventListener('click', () => {
    ensureAudio();
    if (!combatActive || ultiCharge < 100) return;

    ultiCharge = 0;
    updateUltimateCharge();
    btnSuper.disabled = true;

    heroSprite.style.boxShadow = '0 0 50px #f1c40f';
    setTimeout(() => heroSprite.style.boxShadow = '0 0 30px #00e5ff', 500);

    const ultimateDamage = roundDamage(player.ult);
    enemy.hp = roundDamage(enemy.hp - ultimateDamage);
    createFloatingText(enemySprite, `ULTIMATE ${ultimateDamage}!`, 'crit');
    playBattleCue('ulti');
    shakeArena();

    if (enemy.hp <= 0) {
        endCombat(true);
    } else {
        updateUI();
    }
});

updateUltimateCharge();
updateShieldStatus('🛡️ SHIELD READY');
initArena();