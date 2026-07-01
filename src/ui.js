/**
 * ui.js – HUD, health bars, round timer, KO/win screens, character select screen.
 */

const CANVAS_W = 1280;
const CANVAS_H = 720;

const FONT_TITLE  = "900 56px 'Orbitron', monospace";
const FONT_HUD    = "700 16px 'Rajdhani', Arial";
const FONT_TIMER  = "700 30px 'Orbitron', monospace";
const FONT_NAME   = "600 15px 'Rajdhani', Arial";
const FONT_ROUND  = "900 72px 'Orbitron', monospace";
const FONT_FIGHT  = "900 48px 'Orbitron', monospace";
const FONT_SMALL  = "500 18px 'Rajdhani', Arial";

const P1_COLOR    = '#0ea5e9'; // Cinematic Cyan
const P2_COLOR    = '#dc2626'; // Cinematic Crimson
const HP_GREEN    = '#10b981';
const HP_YELLOW   = '#f59e0b';
const HP_RED      = '#dc2626';
const GOLD        = '#f59e0b';
const WHITE       = '#f8fafc';
const DIM         = 'rgba(0,0,0,0.65)';

const BAR_W  = 468;
const BAR_H  = 26;
const BAR_Y  = 28;
const P1_BAR_X = 28;
const P2_BAR_X = CANVAS_W - 28 - BAR_W;

class HitParticle {
  constructor(x, y, heavy) {
    this.x     = x;
    this.y     = y;
    this.r     = heavy ? 28 : 16;
    this.maxR  = heavy ? 60 : 36;
    this.life  = heavy ? 0.28 : 0.18;
    this.t     = 0;
    this.color = heavy ? GOLD : WHITE;
  }
  update(dt) { this.t += dt; }
  get done()  { return this.t >= this.life; }
  draw(ctx) {
    const frac  = this.t / this.life;
    const r     = this.r + (this.maxR - this.r) * frac;
    const alpha = 1 - frac;
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export class UI {
  constructor() {
    this.particles      = [];
    this.screenShakeX   = 0;
    this.screenShakeY   = 0;
    this._shakeTimer    = 0;

    this._flashText     = '';
    this._flashTimer    = 0;
    this._flashDuration = 0;
    this._flashColor    = GOLD;

    this.trailP1 = 1.0;
    this.trailP2 = 1.0;
  }

  triggerHit(x, y, heavy = false) {
    this.particles.push(new HitParticle(x, y, heavy));
    if (heavy) this.triggerScreenShake(0.28);
  }

  triggerScreenShake(duration = 0.25) {
    this._shakeTimer = Math.max(this._shakeTimer, duration);
  }

  flashText(text, duration = 1.8, color = GOLD) {
    this._flashText     = text;
    this._flashTimer    = duration;
    this._flashDuration = duration;
    this._flashColor    = color;
  }

  update(dt) {
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      this.screenShakeX = (Math.random() - 0.5) * 14;
      this.screenShakeY = (Math.random() - 0.5) * 14;
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
    }
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.done);
    if (this._flashTimer > 0) this._flashTimer -= dt;
  }

  draw(ctx, p1, p2, roundTimer, gameState, roundWins, extras = {}) {
    this.particles.forEach(p => p.draw(ctx));

    const hp1 = Math.max(0, p1.health / p1.maxHealth);
    const hp2 = Math.max(0, p2.health / p2.maxHealth);
    
    // Decay health trails
    if (this.trailP1 > hp1) this.trailP1 -= 0.15 * (1/60); // approx dt
    else this.trailP1 = hp1;
    if (this.trailP2 > hp2) this.trailP2 -= 0.15 * (1/60);
    else this.trailP2 = hp2;

    this._drawHealthBar(ctx, hp1, this.trailP1, P1_BAR_X, BAR_Y, true,  'PLAYER 1', P1_COLOR, roundWins[0], p1.health);
    this._drawHealthBar(ctx, hp2, this.trailP2, P2_BAR_X, BAR_Y, false, '  CPU  ',  P2_COLOR, roundWins[1], p2.health);
    this._drawTimer(ctx, roundTimer, CANVAS_W / 2, BAR_Y);
    this._drawDifficultyBadge(ctx, extras.difficulty);

    if (gameState === 'round_intro') this._drawRoundIntro(ctx, roundWins, extras.stateTimer, extras.roundIntroDur);
    if (gameState === 'round_end')   this._drawRoundEnd(ctx, p1, p2);
    if (gameState === 'match_end')   this._drawMatchEnd(ctx, roundWins, p1, p2);

    if (this._flashTimer > 0) {
      const frac  = this._flashTimer / this._flashDuration;
      const scale = 1 + (1 - frac) * 0.15;
      const alpha = Math.min(1, frac * 3);
      
      const drawFlash = (ox, oy, col) => {
        ctx.fillStyle   = col;
        ctx.fillText(this._flashText, ox, oy);
      };

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font        = FONT_FIGHT;
      ctx.textAlign   = 'center';
      ctx.shadowBlur  = 0;
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.scale(scale, scale);
      
      if (this._flashText === 'FIGHT!') {
        // Chromatic aberration
        ctx.globalCompositeOperation = 'screen';
        drawFlash(-4, 0, '#ff0044');
        drawFlash(4, 0, '#00ffff');
        drawFlash(0, 0, this._flashColor);
      } else {
        ctx.shadowColor = this._flashColor;
        ctx.shadowBlur  = 30;
        drawFlash(0, 0, this._flashColor);
      }
      
      ctx.restore();
    }
  }

  _drawHealthBar(ctx, hp, trailHp, barX, barY, isLeft, label, accentColor, wins, rawHealth) {
    const fillW  = BAR_W * hp;
    const trailW = BAR_W * trailHp;
    const fillX  = isLeft ? barX : barX + BAR_W - fillW;
    const trailX = isLeft ? barX : barX + BAR_W - trailW;

    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    _roundRect(ctx, barX - 2, barY - 2, BAR_W + 4, BAR_H + 4, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(barX, barY, BAR_W, BAR_H);

    // Trail
    if (trailW > fillW) {
      ctx.fillStyle = HP_RED; // red damage trail
      ctx.fillRect(trailX, barY, trailW, BAR_H);
    }

    const hpColor = hp > 0.5 ? HP_GREEN : hp > 0.25 ? HP_YELLOW : HP_RED;
    ctx.fillStyle = hpColor;
    ctx.fillRect(fillX, barY, fillW, BAR_H);

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(fillX, barY, fillW, BAR_H * 0.4);

    ctx.strokeStyle = accentColor + 'aa';
    ctx.lineWidth   = 2.0;
    _roundRect(ctx, barX - 2, barY - 2, BAR_W + 4, BAR_H + 4, 4);
    ctx.stroke();

    ctx.font      = FONT_NAME;
    ctx.fillStyle = accentColor;
    ctx.textAlign = isLeft ? 'left' : 'right';
    ctx.fillText(label, isLeft ? barX : barX + BAR_W, barY - 6);

    ctx.font      = "600 12px 'Rajdhani', Arial";
    ctx.fillStyle = WHITE;
    ctx.textAlign = isLeft ? 'right' : 'left';
    ctx.fillText(Math.ceil(rawHealth), isLeft ? barX + BAR_W - 4 : barX + 4, barY + BAR_H - 5);

    for (let i = 0; i < 2; i++) {
      const pipX = isLeft
        ? barX + BAR_W - 16 - i * 18
        : barX + 6 + i * 18;
      ctx.beginPath();
      ctx.arc(pipX, barY - 12, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < wins ? GOLD : 'rgba(255,255,255,0.12)';
      ctx.fill();
    }
  }

  _drawTimer(ctx, t, cx, y) {
    const sec = Math.ceil(Math.max(0, t));
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    _roundRect(ctx, cx - 34, y - 2, 68, BAR_H + 4, 4);
    ctx.fill();

    ctx.strokeStyle = sec <= 9 ? HP_RED + 'aa' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.font      = FONT_TIMER;
    ctx.fillStyle = sec <= 9 ? HP_RED : WHITE;
    ctx.textAlign = 'center';
    ctx.fillText(sec.toString().padStart(2, '0'), cx, y + BAR_H - 4);

    if (sec <= 9) {
      ctx.shadowColor = HP_RED;
      ctx.shadowBlur  = 16;
      ctx.fillText(sec.toString().padStart(2, '0'), cx, y + BAR_H - 4);
      ctx.shadowBlur  = 0;
    }
  }

  _drawDifficultyBadge(ctx, difficulty = 'hard') {
    ctx.font      = "600 11px 'Rajdhani', Arial";
    ctx.fillStyle = '#fca5a5cc';
    ctx.textAlign = 'center';
    ctx.fillText(`HARD MODE`, CANVAS_W / 2, BAR_Y + BAR_H + 14);
  }

  _drawRoundIntro(ctx, roundWins, stateTimer, dur) {
    const round = roundWins[0] + roundWins[1] + 1;
    const introFrac = stateTimer / dur; 
    
    // Cinematic letterboxing animate in
    const barHeight = 80;
    const barAnimY = Math.max(0, 1 - introFrac * 6) * barHeight;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, barAnimY - barHeight, CANVAS_W, barHeight);
    ctx.fillRect(0, CANVAS_H - barAnimY, CANVAS_W, barHeight);

    // Sliding character cards
    const p1Offset = Math.max(0, 1 - introFrac * 3) * -400; 
    const p2Offset = Math.max(0, 1 - introFrac * 3) * 400;

    ctx.save();
    ctx.translate(p1Offset, 0);
    ctx.fillStyle = 'rgba(14,165,233,0.15)'; // P1_COLOR tint
    ctx.fillRect(0, CANVAS_H/2 - 60, CANVAS_W/2, 120);
    ctx.font = "900 64px 'Orbitron', monospace";
    ctx.textAlign = 'right';
    ctx.fillStyle = P1_COLOR;
    ctx.fillText("PLAYER 1", CANVAS_W/2 - 40, CANVAS_H/2 + 20);
    ctx.restore();

    ctx.save();
    ctx.translate(p2Offset, 0);
    ctx.fillStyle = 'rgba(220,38,38,0.15)'; // P2_COLOR tint
    ctx.fillRect(CANVAS_W/2, CANVAS_H/2 - 60, CANVAS_W/2, 120);
    ctx.font = "900 64px 'Orbitron', monospace";
    ctx.textAlign = 'left';
    ctx.fillStyle = P2_COLOR;
    ctx.fillText("CPU", CANVAS_W/2 + 40, CANVAS_H/2 + 20);
    ctx.restore();

    ctx.save();
    ctx.font        = FONT_ROUND;
    ctx.textAlign   = 'center';
    ctx.fillStyle   = WHITE;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur  = 40;
    ctx.fillText(`ROUND  ${round}`, CANVAS_W / 2, CANVAS_H / 2 - 100);
    ctx.restore();
  }

  _drawRoundEnd(ctx, p1, p2) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  _drawMatchEnd(ctx, roundWins, p1, p2) {
    const p1Won = roundWins[0] >= 2;
    const winner = p1Won ? 'PLAYER 1' : 'CPU';
    const color  = p1Won ? P1_COLOR : P2_COLOR;
    
    // Cinematic letterbox & slight darkening
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_W, 80);
    ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);
    
    ctx.save();
    ctx.font        = FONT_TITLE;
    ctx.textAlign   = 'center';
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 60;
    
    // Scaled up text
    ctx.translate(CANVAS_W/2, CANVAS_H/2 - 40);
    ctx.scale(1.2, 1.2);
    ctx.fillText(winner, 0, 0);
    
    ctx.shadowBlur  = 20;
    ctx.font        = FONT_FIGHT;
    ctx.fillStyle   = GOLD;
    ctx.shadowColor = GOLD;
    ctx.fillText('WINS THE MATCH!', 0, 70);
    ctx.restore();

    ctx.font      = FONT_SMALL;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Press  ENTER  to play again', CANVAS_W / 2, CANVAS_H / 2 + 130);
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
