// Solmar Heat — police.js
// The Solmar PD: patrol cars spawn when the player is wanted, chase, ram,
// and bust a slow player who lets them sit on him. Wanted stars rise with
// crimes and fall when the player lays low out of sight.

import { CAR_TYPES, ROAD_CENTERS, TUNING } from './config.js';
import { makeCar } from './traffic.js';
import { snapToRoad, nearestRoadIndex, collideBuildings, clampToWorld } from './world.js';

export function wantedCount(game) {
  // One active cruiser per star, capped so the streets stay playable.
  return Math.min(game.wanted, 3);
}

export function spawnCop(game) {
  const p = game.player;
  const a = game.rng.range(0, Math.PI * 2);
  const dist = game.rng.range(420, 620);
  const snap = snapToRoad(game.rng, p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist);
  const cop = makeCar('police', 'police', snap.x, snap.y, 0, '#1d3fae');
  cop.axis = snap.axis;
  cop.dir = 1;
  cop.road = snap.road;
  cop.cruise = CAR_TYPES.police.maxSpeed;
  cop.speed = CAR_TYPES.police.maxSpeed * 0.5;
  cop.siren = 0;
  game.cars.push(cop);
  game.cops.push(cop);
  return cop;
}

function steerToward(car, tx, ty, dt, turnRate) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = Math.max(-turnRate * dt, Math.min(turnRate * dt, d));
  car.angle += step;
}

function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Waypoints along the road grid from (fromX, fromY) to (toX, toY): the
// nearest vertical road, across on the target's horizontal road, then in.
function routeTo(fromX, fromY, toX, toY) {
  const vx = ROAD_CENTERS[nearestRoadIndex(fromX)];
  const tyr = ROAD_CENTERS[nearestRoadIndex(toY)];
  const txr = ROAD_CENTERS[nearestRoadIndex(toX)];
  const raw = [
    { x: vx, y: fromY },
    { x: vx, y: tyr },
    { x: txr, y: tyr },
    { x: toX, y: toY },
  ];
  const out = [];
  for (const w of raw) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(w.x - last.x, w.y - last.y) > 60) out.push(w);
  }
  return out;
}

function updateCop(game, cop, dt) {
  const spec = CAR_TYPES.police;
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
  const dist = Math.hypot(px - cop.x, py - cop.y);

  // If the player slipped far away, the cruiser gives up and despawns.
  if (dist > 1900) {
    cop.gone = true;
    return;
  }

  // Close in: ram straight at the player, leading a moving target.
  // Far off: follow the road grid — steering straight through blocks
  // grinds a cruiser to a halt against a building. Followers hold their
  // ring point instead of piling onto the player.
  let tx = px, ty = py;
  let cruise = spec.maxSpeed;
  if (!cop.ram) {
    tx = cop.followX ?? px;
    ty = cop.followY ?? py;
    if (dist < 220) cruise = spec.maxSpeed * 0.5;
    steerToward(cop, tx, ty, dt, spec.turn * 0.9);
  } else if (dist > 170) {
    cop.routeT = (cop.routeT || 0) - dt;
    if (!cop.wps || cop.wps.length === 0 || cop.routeT <= 0) {
      cop.wps = routeTo(cop.x, cop.y, px, py);
      cop.routeT = 2.5;
    }
    const wp = cop.wps[0];
    if (wp && Math.hypot(wp.x - cop.x, wp.y - cop.y) < 70) cop.wps.shift();
    if (cop.wps.length) {
      tx = cop.wps[0].x;
      ty = cop.wps[0].y;
      // Coast through sharp turns: a slower car turns tighter.
      if (Math.abs(angDiff(cop.angle, Math.atan2(ty - cop.y, tx - cop.x))) > 0.7) {
        cruise = spec.maxSpeed * 0.35;
      }
    }
    steerToward(cop, tx, ty, dt, spec.turn * 0.9);
  } else {
    const lead = Math.min(0.6, dist / 500);
    tx = px + (p.inCar ? Math.cos(p.inCar.angle) * p.inCar.speed * lead : 0);
    ty = py + (p.inCar ? Math.sin(p.inCar.angle) * p.inCar.speed * lead : 0);
    steerToward(cop, tx, ty, dt, spec.turn * 0.9);
  }

  // Avoid driving through a building: if one is dead ahead, swerve.
  const aheadX = cop.x + Math.cos(cop.angle) * 90;
  const aheadY = cop.y + Math.sin(cop.angle) * 90;
  for (const b of game.city.buildings) {
    if (aheadX > b.x - 10 && aheadX < b.x + b.w + 10 && aheadY > b.y - 10 && aheadY < b.y + b.h + 10) {
      cop.angle += (game.rng.next() < 0.5 ? 1 : -1) * 1.1 * dt * 3;
      break;
    }
  }

  // Stuck against a building? Back up and try a new angle.
  if (cop.speed < 40 && dist > 130) {
    cop.stuckT = (cop.stuckT || 0) + dt;
    if (cop.stuckT > 1.5) {
      cop.stuckT = 0;
      cop.reverseT = 1.0;
      cop.reverseDir = game.rng.next() < 0.5 ? 1 : -1;
    }
  } else {
    cop.stuckT = 0;
  }
  let wantSpeed = dist > 120 ? cruise : spec.maxSpeed * 0.55;
  if (dist < 95 && playerSpeed < 26) wantSpeed = 0; // pull up and hold for the bust
  if (dist < 120 && playerSpeed > 60) wantSpeed = cruise; // a fleeing player gets a full-speed chase, not a glued ram
  if (cop.reverseT > 0) {
    cop.reverseT -= dt;
    cop.angle += cop.reverseDir * 1.6 * dt;
    cop.speed = -110;
  } else if (cop.speed < wantSpeed) cop.speed = Math.min(wantSpeed, cop.speed + spec.accel * dt);
  else cop.speed = Math.max(wantSpeed, cop.speed - spec.brake * dt);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  if (collideBuildings(game.city, cop, 20) && Math.abs(cop.speed) > 120) cop.speed *= 0.5;
  clampToWorld(cop, 24);

  // Bust: a cop sitting on a slow player holds them until the cuffs come out.
  if (game.wanted > 0 && dist < 58 && playerSpeed < 26) {
    game.bustTimer += dt;
    if (game.bustTimer > TUNING.bustHoldTime) game.busted = true;
  }
  // (The timer's decay lives in updatePolice: it must run once per frame,
  // not once per cop, or far followers erase what the close cop builds.)
}

export function updatePolice(game, dt) {
  // Keep the cruiser count matched to the wanted level.
  if (game.wanted > 0) {
    const want = wantedCount(game);
    const active = game.cops.filter((c) => !c.gone).length;
    if (active < want && game.copSpawnT <= 0) {
      spawnCop(game);
      game.copSpawnT = 2.5;
    }
  }
  game.copSpawnT -= dt;
  // Formation: only the closest cruiser rams. The rest hold a slow ring
  // around the player — three cruisers piling onto one spot pin the car
  // against a wall and grind it down together, which no driver escapes.
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const sorted = game.cops.filter((c) => !c.gone).sort((a, b) =>
    Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
  sorted.forEach((cop, i) => {
    cop.ram = i === 0;
    if (!cop.ram) {
      const a = i * 2.4 + game.time * 0.12;
      cop.followX = px + Math.cos(a) * 260;
      cop.followY = py + Math.sin(a) * 260;
    }
  });
  for (const cop of game.cops) {
    if (cop.gone) continue;
    updateCop(game, cop, dt);
  }
  // Bust timer decay, once per frame: only when no cruiser is close.
  const anyClose = game.cops.some((c) => Math.hypot(c.x - px, c.y - py) < 90);
  if (!anyClose) game.bustTimer = Math.max(0, game.bustTimer - dt * 2);
  game.cops = game.cops.filter((c) => !c.gone);
  game.cars = game.cars.filter((c) => !c.gone);
}

// --- wanted level -----------------------------------------------------------

export function addWanted(game, n, reason) {
  if (game.wanted >= TUNING.maxWanted) return;
  game.wanted = Math.min(TUNING.maxWanted, game.wanted + n);
  game.lastCrimeAt = game.time;
  game.wantedNote = reason;
  game.wantedNoteT = 3;
}

export function updateWanted(game, dt) {
  if (game.wanted === 0) return;
  const sinceCrime = game.time - game.lastCrimeAt;
  if (sinceCrime < TUNING.wantedDecayDelay) return;
  // Only cool off when no cruiser is close enough to see the player.
  const p = game.player;
  let nearest = Infinity;
  for (const cop of game.cops) {
    nearest = Math.min(nearest, Math.hypot(cop.x - p.x, cop.y - p.y));
  }
  if (nearest < 380) return;
  game.decayT += dt;
  if (game.decayT >= TUNING.wantedDecayStep) {
    game.decayT = 0;
    game.wanted = Math.max(0, game.wanted - 1);
  }
}
