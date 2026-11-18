// Solmar Heat — helicopter.js
// Two kinds of rotorcraft. The Solmar PD flies a police helicopter once the
// player hits 3 stars: it shadows the player, shines a spotlight on them and
// calls in ground units (cruisers spawn faster while it is up). It can be
// shot down — it falls, explodes, and the crew stops calling it in for a
// while. The second is Rico's ride: a news helicopter parked on the hospital
// helipad that the player can board and fly (W/S thrust, A/D yaw, Space
// climb, Shift descend). Helis fly above buildings and traffic; only the
// ground below matters.

import { TUNING, LANDMARKS } from './config.js';
import { clampToWorld } from './world.js';

let nextHeliId = 1;

export function makeHeli(kind, x, y, angle) {
  return {
    id: nextHeliId++,
    kind, // 'police' | 'player' | 'parked'
    x, y, angle,
    alt: kind === 'parked' ? 0 : 180,
    vx: 0, vy: 0,
    speed: 0,
    hp: TUNING.heliHp,
    rotor: 0,
    gone: false,
    crashing: false,
    crashT: 0,
    spotlight: kind === 'police',
    // police heli only
    callT: 0,
  };
}

// The flyable helicopter, parked on the hospital helipad.
export function spawnParkedHeli(game) {
  const h = makeHeli('parked', LANDMARKS.helipad.x, LANDMARKS.helipad.y, -Math.PI / 2);
  game.helis.push(h);
  return h;
}

export function nearestHeli(game, x, y, maxDist, kinds) {
  let best = null, bd = maxDist;
  for (const h of game.helis) {
    if (kinds && !kinds.includes(h.kind)) continue;
    if (h.crashing || h.gone) continue;
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

export function damageHeli(game, heli, amount) {
  if (heli.crashing || heli.gone) return;
  heli.hp -= amount;
  if (heli.hp <= 0) {
    heli.crashing = true;
    heli.crashT = 1.6;
    game.audio.crash(true);
    game.addParticle(heli.x, heli.y, '#ff8833', 18);
    if (heli.kind === 'police') {
      game.heliDownT = 45; // the PD takes a while to send another one
      game.addWanted(1, 'Police heli down!');
    }
    if (heli === game.player.inHeli) {
      // The wreck throws Rico out on the ground below.
      game.player.inHeli = null;
      game.player.x = heli.x;
      game.player.y = heli.y;
    }
  }
}

function updatePoliceHeli(game, heli, dt) {
  const p = game.player;
  const px = p.inHeli ? p.inHeli.x : p.inCar ? p.inCar.x : p.x;
  const py = p.inHeli ? p.inHeli.y : p.inCar ? p.inCar.y : p.y;
  const dx = px - heli.x, dy = py - heli.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 2400) { heli.gone = true; return; }
  // Shadow the player from above, closing to a hover offset.
  const wantAlt = 170;
  const tx = px - Math.cos(heli.angle) * 40;
  const ty = py - Math.sin(heli.angle) * 40;
  const want = Math.atan2(ty - heli.y, tx - heli.x);
  let d = want - heli.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  heli.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
  const speed = Math.min(TUNING.heliMaxSpeed, dist > 300 ? TUNING.heliMaxSpeed : 120);
  heli.vx += (Math.cos(heli.angle) * speed - heli.vx) * Math.min(1, 2 * dt);
  heli.vy += (Math.sin(heli.angle) * speed - heli.vy) * Math.min(1, 2 * dt);
  heli.x += heli.vx * dt;
  heli.y += heli.vy * dt;
  heli.alt += (wantAlt - heli.alt) * Math.min(1, 1.5 * dt);
  clampToWorld(heli, 30);
  // Call in ground units: cruisers arrive twice as fast while the heli
  // is overhead and the player is wanted.
  heli.callT -= dt;
  if (heli.callT <= 0 && game.wanted > 0) {
    heli.callT = 1.2;
    game.copSpawnT = Math.min(game.copSpawnT, 0.6);
  }
}

function updatePlayerHeli(game, heli, dt) {
  const input = game.input;
  const p = game.player;
  // Yaw.
  heli.angle += input.steer * 2.4 * dt;
  // Thrust along the nose (W forward, S back), plus climb/descend.
  const thrust = (input.throttle ? 1 : 0) - (input.brake ? 0.6 : 0);
  heli.vx += Math.cos(heli.angle) * TUNING.heliAccel * thrust * dt;
  heli.vy += Math.sin(heli.angle) * TUNING.heliAccel * thrust * dt;
  if (input.down('Space')) heli.alt = Math.min(TUNING.heliMaxAlt, heli.alt + TUNING.heliClimb * dt);
  if (input.down('ShiftLeft') || input.down('ShiftRight')) heli.alt = Math.max(0, heli.alt - TUNING.heliClimb * dt);
  // Drag + a gentle hover: without input the heli slows and holds altitude.
  heli.vx *= Math.max(0, 1 - 1.1 * dt);
  heli.vy *= Math.max(0, 1 - 1.1 * dt);
  const sp = Math.hypot(heli.vx, heli.vy);
  if (sp > TUNING.heliMaxSpeed) {
    heli.vx *= TUNING.heliMaxSpeed / sp;
    heli.vy *= TUNING.heliMaxSpeed / sp;
  }
  heli.x += heli.vx * dt;
  heli.y += heli.vy * dt;
  clampToWorld(heli, 30);
  heli.speed = sp;
  p.x = heli.x;
  p.y = heli.y;
  p.angle = heli.angle;
  game.audio.setRotor(true, heli.alt / TUNING.heliMaxAlt);
}

export function updateHelis(game, dt) {
  for (const heli of game.helis) {
    heli.rotor = (heli.rotor + TUNING.heliRotorDps * dt) % 360;
    if (heli.crashing) {
      heli.crashT -= dt;
      heli.alt = Math.max(0, heli.alt - 260 * dt);
      heli.x += heli.vx * dt * 0.4;
      heli.y += heli.vy * dt * 0.4;
      game.addParticle(heli.x, heli.y, '#555555', 2);
      if (heli.crashT <= 0 || heli.alt <= 0) {
        heli.gone = true;
        game.addParticle(heli.x, heli.y, '#ff8833', 26);
        game.addParticle(heli.x, heli.y, '#555555', 18);
        game.shake = Math.max(game.shake, 14);
        game.audio.crash(true);
      }
      continue;
    }
    if (heli.kind === 'police') updatePoliceHeli(game, heli, dt);
    else if (heli.kind === 'player') updatePlayerHeli(game, heli, dt);
    // 'parked' helis sit on the pad; the player boards one with E.
  }
  // Spawn the police heli at 3+ stars (one at a time, with a cooldown
  // after one is shot down).
  game.heliDownT = Math.max(0, (game.heliDownT || 0) - dt);
  if (game.wanted >= TUNING.heliSpawnWanted && game.heliDownT <= 0) {
    const active = game.helis.some((h) => h.kind === 'police' && !h.gone && !h.crashing);
    if (!active) {
      const p = game.player;
      const a = game.rng.range(0, Math.PI * 2);
      const heli = makeHeli('police', p.x + Math.cos(a) * 700, p.y + Math.sin(a) * 700, a);
      heli.alt = 200;
      game.helis.push(heli);
      game.audio.sirenHeli();
    }
  }
  game.helis = game.helis.filter((h) => !h.gone);
  if (!game.helis.some((h) => h.kind === 'police' && !h.gone)) game.audio.setRotor(false, 0);
}

// Board the parked helicopter on the helipad (or exit a landed one).
export function enterHeli(game, heli) {
  const p = game.player;
  heli.kind = 'player';
  heli.alt = 0;
  p.inHeli = heli;
  p.x = heli.x;
  p.y = heli.y;
  game.audio.blip();
}

export function exitHeli(game) {
  const p = game.player;
  const heli = p.inHeli;
  if (!heli) return;
  if (heli.alt > 25) { game.audio.denied(); return false; } // too high to jump out
  heli.kind = 'parked';
  heli.alt = 0;
  heli.vx = 0; heli.vy = 0; heli.speed = 0;
  p.inHeli = null;
  p.x = heli.x + 40;
  p.y = heli.y;
  return true;
}
