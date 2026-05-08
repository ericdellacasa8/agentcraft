/* ═══════════════════════════════════════════════════════════
   NEON VOID — game.js
   Complete arcade wave-survival shooter
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ── Canvas setup ────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
});

// ── Game state ───────────────────────────────────────────────
const GS = {
  screen:     'title',   // 'title' | 'playing' | 'paused' | 'gameover'
  score:      0,
  wave:       1,
  combo:      1,
  comboCount: 0,
  highScore:  parseInt(localStorage.getItem('neonVoidHighScore') || '0', 10),
  lives:      3,
  paused:     false,
};

// ── DOM refs ─────────────────────────────────────────────────
const titleScreen     = document.getElementById('title-screen');
const gameoverScreen  = document.getElementById('gameover-screen');
const pauseScreen     = document.getElementById('pause-screen');
const waveAnnounce    = document.getElementById('wave-announcement');
const waveAnnounceText = document.getElementById('wave-announce-text');
const waveAnnounceSub  = document.getElementById('wave-announce-sub');
const hudEl           = document.getElementById('hud');
const scoreDisplay    = document.getElementById('score-display');
const waveDisplay     = document.getElementById('wave-display');
const healthBar       = document.getElementById('health-bar');
const healthText      = document.getElementById('health-text');
const livesDisplay    = document.getElementById('lives-display');
const shieldPanel     = document.getElementById('shield-panel');
const comboDisplay    = document.getElementById('combo-display');
const comboText       = document.getElementById('combo-text');
const hitFlash        = document.getElementById('hit-flash');
const powerupBar      = document.getElementById('powerup-bar-container');
const powerupFill     = document.getElementById('powerup-bar-fill');
const bossBarCont     = document.getElementById('boss-bar-container');
const bossBarFill     = document.getElementById('boss-bar-fill');
const bossBarText     = document.getElementById('boss-bar-text');
const goScore         = document.getElementById('go-score');
const goWave          = document.getElementById('go-wave');
const goHighscore     = document.getElementById('go-highscore');
const goNewRecord     = document.getElementById('go-new-record');
const titleHSValue    = document.getElementById('title-hs-value');
const playAgainBtn    = document.getElementById('play-again-btn');

// ── Audio ────────────────────────────────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}

function playTone(freq, type, duration, gainVal, startFreq, endFreq, delay) {
  try {
    const ac = getAudioCtx();
    if (!ac) return;
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type || 'sine';
    const t = ac.currentTime + (delay || 0);
    if (startFreq !== undefined && endFreq !== undefined) {
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    } else {
      osc.frequency.setValueAtTime(freq, t);
    }
    gain.gain.setValueAtTime(gainVal || 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch(e) {}
}

function playNoise(duration, gainVal, delay) {
  try {
    const ac = getAudioCtx();
    if (!ac) return;
    const bufSize = ac.sampleRate * duration;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src   = ac.createBufferSource();
    const gain  = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    src.buffer = buf;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    const t = ac.currentTime + (delay || 0);
    gain.gain.setValueAtTime(gainVal || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.start(t);
  } catch(e) {}
}

const Sound = {
  shoot() {
    playTone(880, 'square', 0.08, 0.06);
    playTone(440, 'square', 0.06, 0.03, undefined, undefined, 0.04);
  },
  explosion(big) {
    playTone(big ? 60 : 80, 'sawtooth', big ? 0.5 : 0.25, big ? 0.22 : 0.14);
    playNoise(big ? 0.5 : 0.25, big ? 0.20 : 0.12);
  },
  playerHit() {
    playTone(200, 'sawtooth', 0.18, 0.25);
    playNoise(0.15, 0.18);
    playTone(100, 'square', 0.2, 0.12, undefined, undefined, 0.05);
  },
  powerUp() {
    [0, 0.06, 0.12, 0.18].forEach((d, i) =>
      playTone([330, 440, 550, 660][i], 'sine', 0.15, 0.12, undefined, undefined, d)
    );
  },
  bossAppear() {
    playTone(55, 'sawtooth', 1.2, 0.3);
    playTone(110, 'sine', 0.8, 0.15, undefined, undefined, 0.3);
    playNoise(0.6, 0.1, 0.2);
  },
  comboUp() {
    playTone(660, 'sine', 0.12, 0.12);
    playTone(880, 'sine', 0.1, 0.08, undefined, undefined, 0.08);
  },
  bomb() {
    playNoise(1.0, 0.28);
    playTone(40, 'sine', 1.2, 0.22);
    playTone(80, 'sawtooth', 0.8, 0.18, undefined, undefined, 0.1);
  },
  waveComplete() {
    [0, 0.08, 0.16, 0.24, 0.32].forEach((d, i) =>
      playTone([440, 550, 660, 770, 880][i], 'sine', 0.2, 0.1, undefined, undefined, d)
    );
  }
};

// ── Input ────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Enter') onActionKey();
  if (e.code === 'Escape') onEscape();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('click', () => onActionKey());

function onActionKey() {
  if (GS.screen === 'title') startGame();
  else if (GS.screen === 'gameover') startGame();
}

function onEscape() {
  if (GS.screen === 'playing') togglePause();
}

playAgainBtn.addEventListener('click', () => startGame());

// ── Entities ─────────────────────────────────────────────────

class Player {
  constructor() {
    this.x = W / 2;
    this.y = H * 0.75;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;
    this.hp = 100;
    this.maxHp = 100;
    this.speed = 280;
    this.accel = 800;
    this.friction = 0.88;
    this.shootTimer = 0;
    this.shootInterval = 0.22;
    this.invincible = 0;
    this.blinkTimer = 0;
    this.shield = false;
    this.rapidFire = 0;
    this.rapidFireMax = 5;
    this.thrusterParticles = [];
    this.bobAngle = 0;
  }

  update(dt) {
    // Movement input
    let tx = 0, ty = 0;
    if (keys['KeyA'] || keys['ArrowLeft'])  tx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) tx += 1;
    if (keys['KeyW'] || keys['ArrowUp'])    ty -= 1;
    if (keys['KeyS'] || keys['ArrowDown'])  ty += 1;
    // Normalize diagonal
    const len = Math.sqrt(tx*tx + ty*ty);
    if (len > 0) { tx /= len; ty /= len; }
    // Apply acceleration
    this.vx += (tx * this.speed - this.vx) * Math.min(1, this.accel * dt / this.speed);
    this.vy += (ty * this.speed - this.vy) * Math.min(1, this.accel * dt / this.speed);
    // Friction when no input
    if (len === 0) {
      this.vx *= Math.pow(this.friction, dt * 60);
      this.vy *= Math.pow(this.friction, dt * 60);
    }
    // Move
    this.x = Math.max(this.radius, Math.min(W - this.radius, this.x + this.vx * dt));
    this.y = Math.max(this.radius, Math.min(H - this.radius, this.y + this.vy * dt));

    // Timers
    this.invincible = Math.max(0, this.invincible - dt);
    this.blinkTimer += dt;
    this.bobAngle += dt * 1.8;

    // Rapid fire
    if (this.rapidFire > 0) {
      this.rapidFire -= dt;
      if (this.rapidFire <= 0) {
        this.rapidFire = 0;
        this.shootInterval = 0.22;
        powerupBar.style.display = 'none';
      }
    }

    // Shooting
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = this.shootInterval;
      this.fireAt(findNearestEnemy());
    }

    // Thruster particles
    if (Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10 || true) {
      for (let i = 0; i < 3; i++) {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 8,
          this.y + 14 + Math.random() * 6,
          (Math.random() - 0.5) * 40,
          20 + Math.random() * 60,
          '#00f5ff',
          0.22 + Math.random() * 0.18,
          2 + Math.random() * 3
        ));
      }
    }
  }

  fireAt(target) {
    let angle;
    if (target) {
      angle = Math.atan2(target.y - this.y, target.x - this.x);
    } else {
      angle = -Math.PI / 2; // straight up
    }
    bullets.push(new Bullet(this.x, this.y, angle, 600, '#00f5ff', 6, 'player'));
    Sound.shoot();
  }

  takeDamage(amount) {
    if (this.invincible > 0) return false;
    if (this.shield) {
      this.shield = false;
      shieldPanel.style.display = 'none';
      // Shield absorb effect
      shockwaves.push(new Shockwave(this.x, this.y, '#4488ff', 60, 1.5));
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.invincible = 2.0;
    // Reset combo
    GS.combo = 1;
    GS.comboCount = 0;
    updateComboHUD();
    // Screen effects
    shakeIntensity = Math.max(shakeIntensity, 8);
    triggerHitFlash();
    Sound.playerHit();
    updateHealthHUD();
    if (this.hp <= 0) return true; // died
    return false;
  }

  draw(ctx) {
    const visible = this.invincible <= 0 || (Math.floor(this.blinkTimer * 8) % 2 === 0);
    if (!visible) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow
    ctx.shadowBlur  = 30;
    ctx.shadowColor = '#00f5ff';

    // Ship body (triangle pointing up)
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-14, 14);
    ctx.lineTo(0, 8);
    ctx.lineTo(14, 14);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, -20, 0, 14);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#00f5ff');
    grad.addColorStop(1, '#0088aa');
    ctx.fillStyle = grad;
    ctx.fill();

    // Wing accents
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.arc(0, -4, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,245,255,0.4)';
    ctx.shadowBlur = 20;
    ctx.fill();

    // Engine glow core
    ctx.beginPath();
    ctx.ellipse(0, 10, 5, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 25;
    ctx.fill();

    // Shield ring
    if (this.shield) {
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#4488ff';
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005) * 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

class Enemy {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.hitFlash = 0;
    this.shootTimer = 0;

    const cfg = Enemy.config[type];
    this.hp      = cfg.hp;
    this.maxHp   = cfg.hp;
    this.radius  = cfg.radius;
    this.speed   = cfg.speed;
    this.score   = cfg.score;
    this.color   = cfg.color;
    this.shape   = cfg.shape;
  }

  static config = {
    drifter: { hp:1,  radius:14, speed:70,  score:10,  color:'#ff4444', shape:'triangle' },
    chaser:  { hp:2,  radius:16, speed:140, score:25,  color:'#ff8800', shape:'diamond'  },
    shooter: { hp:3,  radius:18, speed:55,  score:50,  color:'#ff00aa', shape:'hexagon'  },
    brute:   { hp:8,  radius:28, speed:40,  score:100, color:'#cc0000', shape:'octagon'  },
    boss:    { hp:50, radius:52, speed:50,  score:1000,color:'#ffcc00', shape:'star'     },
  };

  update(dt) {
    this.angle += dt * (this.type === 'boss' ? 0.6 : 1.2);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    if (this.type === 'shooter') {
      // Shooter orbits a bit, keeps distance
      const targetDist = 220;
      if (dist < targetDist) {
        // Move away
        this.vx += (-dx / dist) * this.speed * dt * 2;
        this.vy += (-dy / dist) * this.speed * dt * 2;
      } else {
        this.vx += (dx / dist) * this.speed * dt;
        this.vy += (dy / dist) * this.speed * dt;
      }
      this.vx *= 0.9;
      this.vy *= 0.9;
      // Shoot
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 2.0;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        bullets.push(new Bullet(this.x, this.y, angle, 250, '#ff00aa', 5, 'enemy'));
      }
    } else if (this.type === 'boss') {
      // Boss moves toward player slowly, shoots spread
      this.vx += (dx / dist) * this.speed * dt;
      this.vy += (dy / dist) * this.speed * dt;
      this.vx *= 0.92;
      this.vy *= 0.92;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 1.5;
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 / 8) * i + this.angle;
          bullets.push(new Bullet(this.x, this.y, a, 220, '#ffcc00', 6, 'enemy'));
        }
      }
    } else {
      // Drifter / chaser / brute: home toward player
      this.vx += (dx / dist) * this.speed * dt * 3;
      this.vy += (dy / dist) * this.speed * dt * 3;
      const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
      if (spd > this.speed) {
        this.vx = (this.vx / spd) * this.speed;
        this.vy = (this.vy / spd) * this.speed;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 1;
    return this.hp <= 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const flash = this.hitFlash;
    const col   = this.color;

    ctx.shadowBlur  = 18 + Math.sin(Date.now() * 0.004) * 6;
    ctx.shadowColor = col;

    if (flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur  = 30;
    }

    ctx.strokeStyle = flash > 0 ? '#ffffff' : col;
    ctx.fillStyle   = flash > 0
      ? `rgba(255,255,255,${flash * 0.5})`
      : hexToRgba(col, 0.22);
    ctx.lineWidth   = this.type === 'boss' ? 3 : 2;

    switch(this.shape) {
      case 'triangle': drawPolygon(ctx, this.radius, 3); break;
      case 'diamond':  drawDiamond(ctx, this.radius);     break;
      case 'hexagon':  drawPolygon(ctx, this.radius, 6);  break;
      case 'octagon':  drawPolygon(ctx, this.radius, 8);  break;
      case 'star':     drawStar(ctx, this.radius, 8);     break;
    }

    ctx.fill();
    ctx.stroke();

    // HP bar for brute and boss
    if ((this.type === 'brute' || this.type === 'boss') && this.hp < this.maxHp) {
      ctx.rotate(-this.angle);
      const bw = this.radius * 2.2;
      const bh = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-bw/2, this.radius + 4, bw, bh);
      ctx.fillStyle = col;
      ctx.shadowBlur = 6;
      ctx.fillRect(-bw/2, this.radius + 4, bw * (this.hp / this.maxHp), bh);
    }

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, angle, speed, color, radius, owner) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color  = color;
    this.radius = radius;
    this.owner  = owner;
    this.alive  = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -50 || this.x > W + 50 || this.y < -50 || this.y > H + 50) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowBlur  = 16;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life, radius) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color  = color;
    this.life   = life;
    this.maxLife = life;
    this.radius = radius || 3;
    this.alive  = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 30 * dt; // tiny gravity
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Shockwave {
  constructor(x, y, color, maxRadius, duration) {
    this.x = x; this.y = y;
    this.color     = color;
    this.maxRadius = maxRadius;
    this.duration  = duration;
    this.timer     = 0;
    this.alive     = true;
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration) this.alive = false;
  }

  draw(ctx) {
    const t = this.timer / this.duration;
    const r = this.maxRadius * t;
    const a = 1 - t;
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 3 * (1 - t) + 1;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class PowerUp {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind   = kind;
    this.radius = 14;
    this.angle  = 0;
    this.alive  = true;
    this.life   = 8; // seconds before despawn
  }

  static kinds = ['health', 'shield', 'rapidfire', 'bomb'];
  static colors = {
    health:    '#22c55e',
    shield:    '#4488ff',
    rapidfire: '#ffcc00',
    bomb:      '#ff8800',
  };

  update(dt) {
    this.angle += dt * 2;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const col = PowerUp.colors[this.kind];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowBlur  = 18 + Math.sin(Date.now() * 0.006) * 8;
    ctx.shadowColor = col;
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    ctx.fillStyle   = hexToRgba(col, 0.2);

    switch(this.kind) {
      case 'health':
        // Cross
        ctx.fillStyle = col;
        ctx.shadowBlur = 20;
        ctx.fillRect(-3, -11, 6, 22);
        ctx.fillRect(-11, -3, 22, 6);
        break;
      case 'shield':
        drawPolygon(ctx, 13, 6);
        ctx.fill(); ctx.stroke();
        break;
      case 'rapidfire':
        // Lightning bolt
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(4, -12);
        ctx.lineTo(-2, 1);
        ctx.lineTo(3, 1);
        ctx.lineTo(-4, 13);
        ctx.lineTo(2, 0);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case 'bomb':
        drawStar(ctx, 13, 6);
        ctx.fill(); ctx.stroke();
        break;
    }
    ctx.restore();
  }
}

// ── Entity pools ─────────────────────────────────────────────
let player    = null;
let enemies   = [];
let bullets   = [];
let particles = [];
let shockwaves = [];
let powerups  = [];

// ── Screen shake ─────────────────────────────────────────────
let shakeIntensity = 0;

// ── Background ───────────────────────────────────────────────
const stars = [];
for (let i = 0; i < 160; i++) {
  stars.push({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.8 + 0.3,
    flicker: Math.random() * Math.PI * 2,
    flickerSpeed: 1 + Math.random() * 3,
    brightness: 0.4 + Math.random() * 0.6
  });
}

let gridOffset = 0;

function drawBackground(dt) {
  // Base fill
  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, W, H);

  // Stars
  stars.forEach(s => {
    s.flicker += dt * s.flickerSpeed;
    const a = s.brightness * (0.5 + 0.5 * Math.sin(s.flicker));
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,230,255,${a})`;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(100,200,255,0.5)';
    ctx.fill();
  });

  // Perspective grid
  gridOffset = (gridOffset + dt * 60) % 80;
  const vx = W / 2;
  const vy = H * 0.52; // vanishing point slightly above center

  // Vertical diverging lines
  const numV = 18;
  for (let i = 0; i <= numV; i++) {
    const t = i / numV;
    const bx = t * W; // bottom x
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(bx, H + 20);
    ctx.strokeStyle = 'rgba(0,245,255,0.07)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }

  // Horizontal lines (scrolling toward viewer)
  const numH = 22;
  for (let j = 0; j < numH; j++) {
    // Perspective: lines bunch up near vanishing point
    const rawT = ((j / numH) + (gridOffset / (H - vy))) % 1;
    // Exponential distribution for perspective
    const t = rawT * rawT;
    const y = vy + t * (H + 30 - vy);

    // Width at this y level
    const spread = (y - vy) / (H + 30 - vy);
    const x0 = vx - spread * (W * 0.5 + 30);
    const x1 = vx + spread * (W * 0.5 + 30);

    const alpha = 0.04 + t * 0.08;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ── Wave system ──────────────────────────────────────────────
let waveState = 'playing'; // 'playing' | 'announcing' | 'between'
let waveTimer = 0;
let waveEnemiesLeft = 0;
let bossAlive = false;

function buildWave(waveNum) {
  const isBoss = waveNum % 5 === 0;
  const spawnList = [];

  if (isBoss) {
    spawnList.push('boss');
    for (let i = 0; i < 5; i++) spawnList.push('drifter');
  } else {
    const base  = 8 + (waveNum - 1) * 4;
    const drifters = Math.max(2, base - Math.floor((waveNum - 1) * 2.5));
    for (let i = 0; i < drifters; i++) spawnList.push('drifter');

    if (waveNum >= 2) {
      const chasers = Math.min(waveNum - 1, 6);
      for (let i = 0; i < chasers; i++) spawnList.push('chaser');
    }
    if (waveNum >= 3) {
      const shooters = Math.min(Math.floor((waveNum - 2) / 2), 4);
      for (let i = 0; i < shooters; i++) spawnList.push('shooter');
    }
    if (waveNum >= 5) {
      const brutes = Math.min(Math.floor((waveNum - 4) / 2), 3);
      for (let i = 0; i < brutes; i++) spawnList.push('brute');
    }
  }

  return spawnList;
}

function spawnEdge() {
  const side = Math.floor(Math.random() * 4);
  const margin = 60;
  switch(side) {
    case 0: return { x: Math.random() * W, y: -margin };
    case 1: return { x: W + margin, y: Math.random() * H };
    case 2: return { x: Math.random() * W, y: H + margin };
    case 3: return { x: -margin, y: Math.random() * H };
  }
}

function startWaveAnnounce(waveNum) {
  const isBoss = waveNum % 5 === 0;
  waveAnnounceText.textContent = isBoss ? 'BOSS WAVE' : `WAVE ${waveNum}`;
  waveAnnounceText.className   = isBoss ? 'boss-wave' : '';
  waveAnnounceSub.textContent  = isBoss ? '— INCOMING —' : '';
  waveAnnounce.classList.remove('hidden');
  waveState = 'announcing';
  waveTimer = 2.5;
  waveDisplay.textContent = waveNum;
  if (isBoss) Sound.bossAppear();
}

function doSpawnWave(waveNum) {
  const list = buildWave(waveNum);
  list.forEach(type => {
    const pos = spawnEdge();
    enemies.push(new Enemy(type, pos.x, pos.y));
    if (type === 'boss') bossAlive = true;
  });
  waveEnemiesLeft = list.length;
  bossBarCont.style.display = bossAlive ? 'flex' : 'none';
  if (bossAlive) updateBossBar();
  waveState = 'playing';
}

function updateBossBar() {
  const boss = enemies.find(e => e.type === 'boss');
  if (!boss) {
    bossBarCont.style.display = 'none';
    bossAlive = false;
    return;
  }
  const pct = boss.hp / boss.maxHp;
  bossBarFill.style.width = (pct * 100) + '%';
  bossBarText.textContent = `${boss.hp} / ${boss.maxHp}`;
}

// ── Collision ────────────────────────────────────────────────
function circleCollide(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const r  = a.radius + b.radius;
  return dx*dx + dy*dy < r*r;
}

function findNearestEnemy() {
  let nearest = null, minDist = Infinity;
  enemies.forEach(e => {
    const dx = e.x - player.x, dy = e.y - player.y;
    const d = dx*dx + dy*dy;
    if (d < minDist) { minDist = d; nearest = e; }
  });
  return nearest;
}

// ── Spawn power-up ───────────────────────────────────────────
function trySpawnPowerUp(x, y) {
  if (Math.random() < 0.20) {
    const kind = PowerUp.kinds[Math.floor(Math.random() * PowerUp.kinds.length)];
    powerups.push(new PowerUp(x, y, kind));
  }
}

// ── Explosion ────────────────────────────────────────────────
function explode(x, y, color, big) {
  const count = big ? 28 : 18;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const speed = (big ? 120 : 70) + Math.random() * (big ? 180 : 100);
    particles.push(new Particle(
      x + (Math.random()-0.5)*10,
      y + (Math.random()-0.5)*10,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      color,
      0.5 + Math.random() * 0.5,
      big ? 5 : 3
    ));
  }
  shockwaves.push(new Shockwave(x, y, color, big ? 160 : 80, big ? 0.8 : 0.45));
  shakeIntensity = Math.max(shakeIntensity, big ? 18 : 3);
  Sound.explosion(big);
}

// ── Bomb power-up ────────────────────────────────────────────
function triggerBomb() {
  enemies.forEach(e => {
    addScore(e.score);
    explode(e.x, e.y, e.color, e.type === 'boss' || e.type === 'brute');
  });
  enemies = [];
  bossAlive = false;
  bossBarCont.style.display = 'none';
  shakeIntensity = 25;
  Sound.bomb();

  // Full-screen flash
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:#ffffff;z-index:90;pointer-events:none;opacity:0.7;transition:opacity 0.6s';
  document.body.appendChild(flash);
  requestAnimationFrame(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 700);
  });
}

// ── Score ─────────────────────────────────────────────────────
function addScore(base) {
  const earned = base * GS.combo;
  GS.score += earned;
  updateScoreHUD();
  return earned;
}

function onKill(enemy) {
  const base = enemy.score;
  GS.comboCount++;

  const newMulti = Math.min(5, 1 + Math.floor(GS.comboCount / 5));
  if (newMulti > GS.combo) {
    GS.combo = newMulti;
    updateComboHUD();
    Sound.comboUp();
    // Floating combo popup
    showFloatingText(`x${GS.combo} COMBO!`, enemy.x, enemy.y - 30, '#ffcc00', '1.1rem');
  }

  const earned = addScore(base);
  showFloatingText(`+${earned}`, enemy.x, enemy.y, '#ffffff', '0.75rem');

  explode(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' || enemy.type === 'brute');
  trySpawnPowerUp(enemy.x, enemy.y);

  if (enemy.type === 'boss') {
    shakeIntensity = 20;
  }
}

// ── HUD Updates ───────────────────────────────────────────────
function updateScoreHUD() {
  scoreDisplay.textContent = GS.score.toLocaleString();
}

function updateHealthHUD() {
  const pct = Math.max(0, player.hp / player.maxHp);
  healthBar.style.width = (pct * 100) + '%';
  healthBar.style.background = pct > 0.5
    ? 'linear-gradient(90deg,#00c4cc,#00f5ff)'
    : pct > 0.25
    ? 'linear-gradient(90deg,#ff8800,#ffcc00)'
    : 'linear-gradient(90deg,#cc0000,#ff4444)';
  healthText.textContent = Math.ceil(player.hp);
}

function updateLivesHUD() {
  const icons = livesDisplay.querySelectorAll('.life-icon');
  icons.forEach((ic, i) => {
    ic.classList.toggle('lost', i >= GS.lives);
  });
}

function updateComboHUD() {
  if (GS.combo <= 1) {
    comboDisplay.classList.add('hidden');
  } else {
    comboDisplay.classList.remove('hidden');
    comboText.textContent = `x${GS.combo} COMBO!`;
    // Retrigger animation
    comboDisplay.style.animation = 'none';
    comboDisplay.offsetHeight; // reflow
    comboDisplay.style.animation = '';
  }
}

// ── Floating text popups ──────────────────────────────────────
function showFloatingText(text, x, y, color, size) {
  const el = document.createElement('div');
  el.className = 'score-popup';
  el.textContent = text;
  el.style.cssText = `left:${x}px;top:${y}px;color:${color};font-size:${size || '0.85rem'};transform:translateX(-50%);`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ── Hit flash ────────────────────────────────────────────────
let hitFlashTimer = 0;
function triggerHitFlash() {
  hitFlash.style.opacity = '1';
  hitFlashTimer = 0.12;
}

// ── Game flow ─────────────────────────────────────────────────
function showScreen(name) {
  titleScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  waveAnnounce.classList.add('hidden');
  hudEl.style.visibility = 'hidden';
  powerupBar.style.display = 'none';
  bossBarCont.style.display = 'none';

  if (name === 'title') {
    titleScreen.classList.remove('hidden');
    titleHSValue.textContent = GS.highScore.toLocaleString();
  } else if (name === 'gameover') {
    gameoverScreen.classList.remove('hidden');
    animateScoreCount();
  } else if (name === 'pause') {
    pauseScreen.classList.remove('hidden');
    hudEl.style.visibility = 'visible';
  } else if (name === 'playing') {
    hudEl.style.visibility = 'visible';
  }
}

function startGame() {
  // Reset state
  GS.screen     = 'playing';
  GS.score      = 0;
  GS.wave       = 1;
  GS.combo      = 1;
  GS.comboCount = 0;
  GS.lives      = 3;

  enemies   = [];
  bullets   = [];
  particles = [];
  shockwaves = [];
  powerups  = [];
  shakeIntensity = 0;
  bossAlive = false;

  player = new Player();
  updateScoreHUD();
  updateHealthHUD();
  updateLivesHUD();
  updateComboHUD();
  shieldPanel.style.display = 'none';
  powerupBar.style.display  = 'none';
  bossBarCont.style.display = 'none';

  showScreen('playing');
  startWaveAnnounce(1);
}

function togglePause() {
  if (GS.screen === 'playing') {
    GS.screen = 'paused';
    showScreen('pause');
  } else if (GS.screen === 'paused') {
    GS.screen = 'playing';
    showScreen('playing');
    lastTime = performance.now();
  }
}

function playerDie() {
  GS.lives--;
  updateLivesHUD();
  if (GS.lives <= 0) {
    endGame();
  } else {
    // Respawn
    player.x = W / 2;
    player.y = H * 0.75;
    player.vx = 0;
    player.vy = 0;
    player.hp = 100;
    player.invincible = 2.0;
    player.shield = false;
    shieldPanel.style.display = 'none';
    updateHealthHUD();
    shakeIntensity = 10;
  }
}

function endGame() {
  GS.screen = 'gameover';
  const isNewRecord = GS.score > GS.highScore;
  if (isNewRecord) {
    GS.highScore = GS.score;
    localStorage.setItem('neonVoidHighScore', GS.highScore);
    titleHSValue.textContent = GS.highScore.toLocaleString();
  }
  goWave.textContent      = GS.wave;
  goHighscore.textContent = GS.highScore.toLocaleString();
  goNewRecord.classList.toggle('hidden', !isNewRecord);
  showScreen('gameover');
}

function animateScoreCount() {
  const target = GS.score;
  let current  = 0;
  const step   = Math.max(1, Math.ceil(target / 60));
  goScore.textContent = '0';
  const interval = setInterval(() => {
    current = Math.min(target, current + step);
    goScore.textContent = current.toLocaleString();
    if (current >= target) clearInterval(interval);
  }, 16);
}

// ── Title screen demo enemies ─────────────────────────────────
let demoEnemies = [];
function spawnDemoEnemy() {
  const types = ['drifter','chaser','shooter'];
  const type = types[Math.floor(Math.random() * types.length)];
  const side = Math.floor(Math.random() * 4);
  let x, y;
  switch(side) {
    case 0: x = Math.random()*W; y = -40; break;
    case 1: x = W+40; y = Math.random()*H; break;
    case 2: x = Math.random()*W; y = H+40; break;
    case 3: x = -40; y = Math.random()*H; break;
  }
  demoEnemies.push({ x, y, type, angle: 0, vx: (W/2-x)*0.0005*60, vy: (H/2-y)*0.0005*60, life: 8 });
}

// ── Main loop ─────────────────────────────────────────────────
let lastTime = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Hit flash decay
  if (hitFlashTimer > 0) {
    hitFlashTimer -= dt;
    if (hitFlashTimer <= 0) {
      hitFlash.style.opacity = '0';
      hitFlashTimer = 0;
    }
  }

  // Screen shake decay
  shakeIntensity *= Math.pow(0.82, dt * 60);
  if (shakeIntensity < 0.05) shakeIntensity = 0;
  const sx = shakeIntensity > 0 ? (Math.random() - 0.5) * shakeIntensity * 2 : 0;
  const sy = shakeIntensity > 0 ? (Math.random() - 0.5) * shakeIntensity * 2 : 0;

  ctx.save();
  ctx.translate(sx, sy);

  // Always draw background
  drawBackground(dt);

  if (GS.screen === 'title') {
    // Demo enemies
    if (Math.random() < 0.02) spawnDemoEnemy();
    demoEnemies.forEach(e => {
      e.angle += dt * 1.2;
      e.x += e.vx * dt * 60 * dt;
      e.y += e.vy * dt * 60 * dt;
      e.life -= dt;
      const cfg = Enemy.config[e.type];
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.shadowBlur  = 15;
      ctx.shadowColor = cfg.color;
      ctx.strokeStyle = cfg.color;
      ctx.fillStyle   = hexToRgba(cfg.color, 0.15);
      ctx.lineWidth   = 1.5;
      switch(Enemy.config[e.type].shape) {
        case 'triangle': drawPolygon(ctx, cfg.radius, 3); break;
        case 'diamond':  drawDiamond(ctx, cfg.radius);    break;
        case 'hexagon':  drawPolygon(ctx, cfg.radius, 6); break;
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    demoEnemies = demoEnemies.filter(e => e.life > 0 &&
      e.x > -200 && e.x < W+200 && e.y > -200 && e.y < H+200);

  } else if (GS.screen === 'playing' || GS.screen === 'paused') {

    if (GS.screen === 'playing') {
      // Wave state machine
      if (waveState === 'announcing') {
        waveTimer -= dt;
        if (waveTimer <= 0) {
          waveAnnounce.classList.add('hidden');
          doSpawnWave(GS.wave);
        }
      } else if (waveState === 'playing') {
        // Check wave clear
        if (enemies.length === 0 && waveEnemiesLeft > 0) {
          waveEnemiesLeft = 0;
          Sound.waveComplete();
          shakeIntensity = Math.max(shakeIntensity, 5);
          // Brief screen flash
          const fl = document.createElement('div');
          fl.style.cssText = 'position:fixed;inset:0;background:#ffffff;z-index:90;pointer-events:none;opacity:0.18;transition:opacity 0.5s';
          document.body.appendChild(fl);
          setTimeout(() => { fl.style.opacity='0'; setTimeout(()=>fl.remove(),600); }, 50);

          GS.wave++;
          setTimeout(() => startWaveAnnounce(GS.wave), 1000);
        }
      }

      // Update entities
      player.update(dt);
      enemies.forEach(e => e.update(dt));
      bullets.forEach(b => b.update(dt));
      particles.forEach(p => p.update(dt));
      shockwaves.forEach(s => s.update(dt));
      powerups.forEach(p => p.update(dt));

      // Player bullets vs enemies
      bullets.filter(b => b.owner === 'player' && b.alive).forEach(b => {
        enemies.forEach(e => {
          if (!b.alive) return;
          if (circleCollide(b, e)) {
            b.alive = false;
            const died = e.takeDamage(1);
            if (died) {
              onKill(e);
            }
          }
        });
      });

      // Enemy bullets vs player
      bullets.filter(b => b.owner === 'enemy' && b.alive).forEach(b => {
        if (circleCollide(b, player)) {
          b.alive = false;
          const died = player.takeDamage(10);
          if (died) playerDie();
        }
      });

      // Enemies vs player (contact) — guard hp > 0 so just-killed enemies don't deal phantom damage
      enemies.filter(e => e.hp > 0).forEach(e => {
        if (circleCollide(e, player)) {
          const died = player.takeDamage(20);
          if (died) playerDie();
        }
      });

      // Player vs power-ups
      powerups.forEach(p => {
        if (circleCollide(p, player)) {
          p.alive = false;
          applyPowerUp(p.kind);
        }
      });

      // Cleanup
      enemies   = enemies.filter(e => e.hp > 0);
      bullets   = bullets.filter(b => b.alive);
      particles = particles.filter(p => p.alive);
      shockwaves = shockwaves.filter(s => s.alive);
      powerups  = powerups.filter(p => p.alive);

      // Boss bar
      if (bossAlive) updateBossBar();

      // Rapid fire bar
      if (player.rapidFire > 0) {
        powerupBar.style.display = 'flex';
        powerupFill.style.width = ((player.rapidFire / player.rapidFireMax) * 100) + '%';
      }
    }

    // Draw
    particles.forEach(p => p.draw(ctx));
    shockwaves.forEach(s => s.draw(ctx));
    powerups.forEach(p => p.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    if (player) player.draw(ctx);

  } else if (GS.screen === 'gameover') {
    // Draw particles lingering
    particles.forEach(p => { p.update(dt); p.draw(ctx); });
    particles = particles.filter(p => p.alive);
    shockwaves.forEach(s => { s.update(dt); s.draw(ctx); });
    shockwaves = shockwaves.filter(s => s.alive);
  }

  ctx.restore();
}

function applyPowerUp(kind) {
  Sound.powerUp();
  switch(kind) {
    case 'health':
      player.hp = Math.min(player.maxHp, player.hp + 30);
      updateHealthHUD();
      showFloatingText('+30 HULL', player.x, player.y - 40, '#22c55e', '1rem');
      break;
    case 'shield':
      player.shield = true;
      shieldPanel.style.display = '';
      showFloatingText('SHIELD!', player.x, player.y - 40, '#4488ff', '1rem');
      break;
    case 'rapidfire':
      player.rapidFire = player.rapidFireMax;
      player.shootInterval = 0.11;
      powerupBar.style.display = 'flex';
      showFloatingText('RAPID FIRE!', player.x, player.y - 40, '#ffcc00', '1rem');
      break;
    case 'bomb':
      showFloatingText('BOMB!', player.x, player.y - 40, '#ff8800', '1.2rem');
      setTimeout(triggerBomb, 50);
      break;
  }
}

// ── Drawing helpers ───────────────────────────────────────────
function drawPolygon(ctx, radius, sides) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 / sides) * i - Math.PI / 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawDiamond(ctx, radius) {
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.65, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius * 0.65, 0);
  ctx.closePath();
}

function drawStar(ctx, radius, points) {
  const inner = radius * 0.42;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? radius : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Boot ──────────────────────────────────────────────────────
GS.screen = 'title';
showScreen('title');
titleHSValue.textContent = GS.highScore.toLocaleString();
requestAnimationFrame(loop);
