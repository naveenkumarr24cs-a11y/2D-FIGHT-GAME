/**
 * main.js – Entry point: wires Engine, Input, Fighters, AI, Combat,
 * Background, and UI together, then runs the full match loop.
 *
 * Serve with: python -m http.server 8080
 */

import { Engine }              from './engine.js';
import { Input }               from './input.js';
import { loadColourAnimations } from './animationLoader.js';
import { Fighter }             from './fighter.js';
import { AIController }        from './ai.js';
import { CombatSystem }        from './combat.js';
import { Background }          from './background.js';
import { UI }                  from './ui.js';

// ── Constants ──────────────────────────────────────────────────────────────

const CANVAS_W  = 1280;
const CANVAS_H  = 720;
const GROUND_Y  = 628;
const P1_START  = { x: 360, y: GROUND_Y, facing:  1 };
const P2_START  = { x: 920, y: GROUND_Y, facing: -1 };

const ROUND_TIME     = 60;
const ROUNDS_TO_WIN  = 2;
const ROUND_INTRO_DUR = 2.4;
const ROUND_END_DUR   = 3.0;

// ── Exact file lists ───────────────────────────────────────────────────────

const COLOUR1_FILES = [
  '_Attack.png', '_Attack2.png', '_Attack2NoMovement.png', '_AttackCombo2hit.png',
  '_AttackComboNoMovement.png', '_AttackNoMovement.png', '_Crouch.png',
  '_CrouchAttack.png', '_CrouchFull.png', '_CrouchTransition.png',
  '_CrouchWalk.png', '_Dash.png', '_Death.png', '_DeathNoMovement.png',
  '_Fall.png', '_Hit.png', '_Idle.png', '_Jump.png', '_JumpFallInbetween.png',
  '_Roll.png', '_Run.png', '_Slide.png', '_SlideFull.png',
  '_SlideTransitionEnd.png', '_SlideTransitionStart.png', '_TurnAround.png',
  '_WallClimb.png', '_WallClimbNoMovement.png', '_WallHang.png', '_WallSlide.png',
];

const COLOUR2_FILES = [
  '_Attack.png', '_Attack2.png', '_Attack2NoMovement.png', '_AttackCombo.png',
  '_AttackComboNoMovement.png', '_AttackNoMovement.png', '_Crouch.png',
  '_CrouchAll.png', '_CrouchAttack.png', '_CrouchTransition.png',
  '_CrouchWalk.png', '_Dash.png', '_Death.png', '_DeathNoMovement.png',
  '_Fall.png', '_Hit.png', '_Idle.png', '_Jump.png', '_JumpFallInbetween.png',
  '_Roll.png', '_Run.png', '_Slide.png', '_SlideAll.png',
  '_SlideTransitionEnd.png', '_SlideTransitionStart.png', '_TurnAround.png',
  '_WallClimb.png', '_WallClimbNoMovement.png', '_WallHang.png', '_WallSlide.png',
];

const ROSTER = [
  { id: 'c3', name: 'NINJA BLUE', load: (onlyIdle) => loadColourAnimations('Character Colour1/Outline/120x80_PNGSheets', COLOUR1_FILES, 12, onlyIdle), color: '#38bdf8', scale: 2.2, shadowW: 45 },
  { id: 'c4', name: 'NINJA RED', load: (onlyIdle) => loadColourAnimations('Character Colour2/Outline/120x80_PNGSheets', COLOUR2_FILES, 12, onlyIdle), color: '#ef4444', scale: 2.2, shadowW: 45 },
];

const GS = Object.freeze({
  ROUND_INTRO: 'round_intro',
  FIGHTING:    'fighting',
  ROUND_END:   'round_end',
  MATCH_END:   'match_end',
});

function setLoaderProgress(pct, label = '') {
  const fill  = document.getElementById('loader-fill');
  const lbl   = document.getElementById('loader-label');
  if (fill) fill.style.width = `${Math.round(pct)}%`;
  if (lbl && label) lbl.textContent = label;
}

function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (el) el.classList.add('hidden');
}

function pushApart(p1, p2) {
  const minDist = (p1.hurtW + p2.hurtW) / 2 + 4;
  const dx      = p2.x - p1.x;
  const dist    = Math.abs(dx);
  if (dist < minDist) {
    const push = (minDist - dist) / 2;
    const dir  = dx >= 0 ? 1 : -1;
    p1.x -= dir * push;
    p2.x += dir * push;
    p1.x = Math.max(80, Math.min(1200, p1.x));
    p2.x = Math.max(80, Math.min(1200, p2.x));
  }
}

async function init() {
  const canvas = document.getElementById('game-canvas');
  const engine = new Engine(canvas, CANVAS_W, CANVAS_H);
  const input  = new Input();
  const ui     = new UI();
  const combat = new CombatSystem();

  setLoaderProgress(5, 'Loading background manifest…');
  let bgManifest;
  try {
    bgManifest = await fetch('./bg-manifest.json').then(r => r.json());
  } catch (e) {
    console.error('[Main] Could not fetch bg-manifest.json', e);
    bgManifest = {};
  }
  const bgKeys = Object.keys(bgManifest);

  setLoaderProgress(50, 'Loading characters…');

  // Load P1 and P2 full assets immediately
  const c1 = ROSTER[0];
  const c2 = ROSTER[1];

  const [p1Anims, p2Anims] = await Promise.all([
    c1.load(false),
    c2.load(false)
  ]);

  setLoaderProgress(100, 'Click to Start');
  
  await new Promise((resolve) => {
    const startHandler = () => {
      document.removeEventListener('click', startHandler);
      document.removeEventListener('keydown', startHandler);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      resolve();
    };
    document.addEventListener('click', startHandler);
    document.addEventListener('keydown', startHandler);
  });
  
  hideLoadingScreen();

  setTimeout(() => {
    const cb = document.getElementById('controls-bar');
    if (cb) cb.classList.add('hidden');
  }, 5000);

  let p1 = new Fighter({
    x: P1_START.x, y: P1_START.y, facing: P1_START.facing,
    animations: p1Anims, color: c1.color, isPlayer: true,
    displayScale: c1.scale, shadowW: c1.shadowW
  });
  
  let p2 = new Fighter({
    x: P2_START.x, y: P2_START.y, facing: P2_START.facing,
    animations: p2Anims, color: c2.color, isPlayer: false,
    displayScale: c2.scale, shadowW: c2.shadowW
  });

  let background = new Background(bgManifest);
  let ai = new AIController(p2, p1, 'hard');

  let gameState  = GS.ROUND_INTRO;
  let stateTimer = 0;
  let roundTimer = ROUND_TIME;
  let roundWins  = [0, 0];
  
  let selectedBgKey = 'bg_1';

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F1') {
      p1.debug = !p1.debug;
      p2.debug = !p2.debug;
      return;
    }
    if (gameState === GS.MATCH_END && e.code === 'Enter') {
      roundWins = [0, 0];
      startMatch();
    }
  });

  async function startMatch() {
    selectedBgKey = bgKeys.length ? bgKeys[Math.floor(Math.random() * bgKeys.length)] : 'bg_1';
    await background.load(selectedBgKey);
    startRound();
  }

  function startRound() {
    p1.reset(P1_START.x, P1_START.y, P1_START.facing);
    p2.reset(P2_START.x, P2_START.y, P2_START.facing);
    
    p1.update(0, p2.x);
    p2.update(0, p1.x);

    roundTimer = ROUND_TIME;
    gameState  = GS.ROUND_INTRO;
    stateTimer = 0;
    
    ui.flashText(selectedBgKey.replace('bg_', 'STAGE '), ROUND_INTRO_DUR * 0.7, '#f8fafc');
  }

  function endRound() {
    if (p1.health > p2.health)      roundWins[0]++;
    else if (p2.health > p1.health)  roundWins[1]++;

    if (roundWins[0] >= ROUNDS_TO_WIN || roundWins[1] >= ROUNDS_TO_WIN) {
      gameState  = GS.MATCH_END;
    } else {
      gameState  = GS.ROUND_END;
      stateTimer = ROUND_END_DUR;
    }
  }

  // Start first match
  await startMatch();

  engine.start((dt) => {
    ui.update(dt);

    switch (gameState) {
      case GS.ROUND_INTRO:
        stateTimer += dt;
        p1.update(dt);
        p2.update(dt);
        if (stateTimer >= ROUND_INTRO_DUR) {
          ui.flashText('FIGHT!', 0.9, '#fbbf24');
          gameState = GS.FIGHTING;
        }
        break;

      case GS.FIGHTING:
        p1.handleInput(input);
        ai.update(dt);

        if (p1.onGround && p1.canAct()) p1.facing = p2.x > p1.x ? 1 : -1;
        if (p2.onGround && p2.canAct()) p2.facing = p1.x > p2.x ? 1 : -1;

        p1.update(dt, p2.x);
        p2.update(dt, p1.x);

        pushApart(p1, p2);
        background.update(p1.x, p2.x, CANVAS_W);

        combat.check(p1, p2, (hit) => {
          const heavy = hit.damage >= 20;
          const hx = (p1.getHitbox()?.x ?? p1.x) + 30;
          const hy = p2.y - 90;
          ui.triggerHit(hx, hy, heavy);
          if (heavy) { p1.triggerShake(0.15); p2.triggerShake(0.22); }
        });

        combat.check(p2, p1, (hit) => {
          const heavy = hit.damage >= 20;
          const hx = (p2.getHitbox()?.x ?? p2.x) + 30;
          const hy = p1.y - 90;
          ui.triggerHit(hx, hy, heavy);
          if (heavy) { p2.triggerShake(0.15); p1.triggerShake(0.22); }
        });

        roundTimer -= dt;
        const p1Dead = p1.health <= 0;
        const p2Dead = p2.health <= 0;
        if (p1Dead || p2Dead) {
          if (p2Dead && !p1Dead) ui.flashText('K.O.!', 2.0, c1.color);
          else if (p1Dead)       ui.flashText('K.O.!', 2.0, c2.color);
          engine.setSlowMo(0.25, 0.6);
          endRound();
        } else if (roundTimer <= 0) {
          ui.flashText('TIME!', 1.8, '#f8fafc');
          endRound();
        }
        break;

      case GS.ROUND_END:
        p1.update(dt);
        p2.update(dt);
        stateTimer -= dt;
        if (stateTimer <= 0) startRound();
        break;

      case GS.MATCH_END:
        p1.update(dt);
        p2.update(dt);
        break;
    }

    // Capture input buffer AT THE END of the frame
    input.update();

    const ctx = engine.ctx;
    ctx.save();
    ctx.translate(ui.screenShakeX, ui.screenShakeY);

    background.draw(ctx, CANVAS_W, CANVAS_H);
    
    if (p1.x < p2.x) { p1.draw(ctx); p2.draw(ctx); }
    else             { p2.draw(ctx); p1.draw(ctx); }

    ctx.restore();

    ui.draw(ctx, p1, p2, roundTimer, gameState, roundWins, {
      difficulty: 'hard',
      stateTimer: stateTimer,
      roundIntroDur: ROUND_INTRO_DUR,
    });
  });
}

init().catch((err) => {
  console.error('[Main] Fatal init error:', err);
  const lbl = document.getElementById('loader-label');
  if (lbl) lbl.textContent = 'Error: ' + err.message;
  const fill = document.getElementById('loader-fill');
  if (fill) fill.style.background = '#ef4444';
});
