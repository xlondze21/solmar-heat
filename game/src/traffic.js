// Solmar Heat — traffic.js
// Civilian traffic: cars that follow the road grid, keep their lane, stop at
// red lights, queue behind the car ahead, and turn at intersections. Parked
// cars are scenery the player can steal.

import { CAR_TYPES, ROAD_CENTERS, ROAD_W, TUNING } from './config.js';
import { makeRng } from './random.js';
import { nearestRoadIndex, nearestLight, lightIsGreen, collideBuildings, clampToWorld, snapToRoad } from './world.js';

let nextCarId = 1;

export function makeCar(kind, type, x, y, angle, color) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    type,
    x, y, angle,
    speed: 0,
    color: color || spec.colors[0],
    len: spec.len, wid: spec.wid,
    hp: 100,
    smoke: 0,
    // traffic AI state
    axis: 'v', dir: 1, road: 0,
    cruise: spec.maxSpeed * 0.62,
    turnCooldown: 0,
    stuck: 0,
  };
}

export function spawnTraffic(game, count) {
  const rng = game.rng;
  const cars = [];
  for (let n = 0; n < count; n++) {
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sports']);
    const spec = CAR_TYPES[type];
    const rx = rng.range(150, 4650);
    const ry = rng.range(150, 4400);
    const snap = snapToRoad(rng, rx, ry);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = 15; // right-hand lane offset
    let x = snap.x, y = snap.y, angle = 0;
    if (snap.axis === 'v') {
      x += dir > 0 ? -lane : lane;
      y = rng.range(150, 4400);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y += dir > 0 ? lane : -lane;
      x = rng.range(150, 4650);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCar('traffic', type, x, y, angle, rng.pick(spec.colors));
    car.axis = snap.axis;
    car.dir = dir;
    car.road = snap.road;
    car.cruise = spec.maxSpeed * rng.range(0.5, 0.7);
    car.speed = car.cruise * rng.range(0.5, 1);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(game, count) {
  const rng = game.rng;
  const cars = [];
  for (let n = 0; n < count; n++) {
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'sports', 'truck']);
    const spec = CAR_TYPES[type];
    let placed = null;
    // Re-roll until the spot is clear of buildings: a car half inside a
    // building grinds to a halt the moment the player tries to drive it.
    for (let attempt = 0; attempt < 12 && !placed; attempt++) {
      const vertical = rng.chance(0.5);
      const road = ROAD_CENTERS[rng.int(0, ROAD_CENTERS.length - 1)];
      const along = rng.range(300, 4500);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = vertical ? road + side * (ROAD_W / 2 + 6) : along;
      const y = vertical ? along : road + side * (ROAD_W / 2 + 6);
      if (y > 4460) continue; // keep the beach clear
      const probe = { x, y };
      if (collideBuildings(game.city, probe, 26)) continue;
      const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      placed = makeCar('parked', type, x, y, angle, rng.pick(spec.colors));
    }
    if (placed) cars.push(placed);
  }
  return cars;
}

// --- traffic AI -------------------------------------------------------------

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function headingFor(axis, dir) {
  if (axis === 'v') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function updateTrafficCar(game, car, dt) {
  const spec = CAR_TYPES[car.type];
  const time = game.time;
  // Where is the next intersection on my road?
  const along = car.axis === 'v' ? car.y : car.x;
  const roadPos = ROAD_CENTERS[car.road];
  let nextCenter = null;
  for (const c of ROAD_CENTERS) {
    if (car.dir > 0 && c > along + 5) { nextCenter = c; break; }
    if (car.dir < 0 && c < along - 5) { nextCenter = c; break; }
  }
  if (nextCenter === null) {
    // End of the road: turn around.
    car.dir *= -1;
    nextCenter = ROAD_CENTERS[car.dir > 0 ? 0 : ROAD_CENTERS.length - 1];
  }
  const distToNext = Math.abs(nextCenter - along);

  // Stop line: red light, or a car ahead in my lane.
  let targetSpeed = car.cruise;
  if (distToNext < 95 && distToNext > 8) {
    const light = nearestLight(game.city, car.axis === 'v' ? roadPos : nextCenter, car.axis === 'v' ? nextCenter : roadPos);
    if (light && !lightIsGreen(light, time, car.axis)) targetSpeed = 0;
  }
  for (const other of game.cars) {
    if (other === car || other.kind === 'parked') continue;
    if (other.axis !== car.axis || other.dir !== car.dir || other.road !== car.road) continue;
    const ahead = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
    if (ahead > 0 && ahead < 85) {
      targetSpeed = ahead < 48 ? 0 : Math.min(targetSpeed, other.speed * 0.85);
    }
  }
  // Ease toward the target speed.
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + spec.accel * 0.8 * dt);
  else car.speed = Math.max(targetSpeed, car.speed - spec.brake * dt);

  // Turn at the intersection: pick a new road.
  if (distToNext < 14 && car.turnCooldown <= 0) {
    const r = game.rng.next();
    const crossRoad = nearestRoadIndex(car.axis === 'v' ? car.y : car.x);
    if (r < 0.62) {
      // straight on
    } else if (r < 0.81) {
      car.axis = car.axis === 'v' ? 'h' : 'v';
      car.road = crossRoad;
      car.dir = game.rng.chance(0.5) ? 1 : -1;
    } else {
      car.dir *= -1;
    }
    car.turnCooldown = 1.2;
  }
  car.turnCooldown -= dt;

  // Steer toward the lane heading and roll forward.
  const lane = 15;
  const want = headingFor(car.axis, car.dir);
  car.angle = angleLerp(car.angle, want, Math.min(1, 3.2 * dt));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Ease back onto the lane centreline (recomputed: a turn may have changed road).
  const laneRoad = ROAD_CENTERS[car.road];
  const laneTarget = car.axis === 'v'
    ? laneRoad + (car.dir > 0 ? -lane : lane)
    : laneRoad + (car.dir > 0 ? lane : -lane);
  if (car.axis === 'v') car.x += (laneTarget - car.x) * Math.min(1, 1.6 * dt);
  else car.y += (laneTarget - car.y) * Math.min(1, 1.6 * dt);
  if (collideBuildings(game.city, car, 20) && Math.abs(car.speed) > 120) car.speed *= 0.4;
  clampToWorld(car, 24);
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.kind === 'parked') {
      // A shoved parked car rolls to a stop instead of sliding forever.
      const drag = 130 * dt;
      car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
      if (car.speed !== 0) {
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (collideBuildings(game.city, car, 20)) car.speed *= 0.5;
        clampToWorld(car, 24);
      }
      continue;
    }
    if (car.kind !== 'traffic') continue;
    updateTrafficCar(game, car, dt);
  }
}

// --- collisions between cars ------------------------------------------------

// Circle-ish push-apart for two cars; returns impact speed for crash effects.
// The faster car shoves the slower one along the push direction and keeps
// most of its speed — equalising both speeds pins a car behind a parked one
// at a crawl, which is what the old version did. The positional push-apart
// runs every frame, but the shove and the impact only fire on a fresh
// contact (at most once per 0.35 s per pair): while two cars grind together
// a per-frame shove pins the slower one in place and a per-frame impact
// grinds its whole health bar away in under a second.
export function collideCars(a, b, now = 0) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = (a.len + b.len) / 2 - 14;
  if (dist >= min || dist < 0.01) return 0;
  const nx = dx / dist, ny = dy / dist;
  const overlap = (min - dist) / 2;
  a.x -= nx * overlap; a.y -= ny * overlap;
  b.x += nx * overlap; b.y += ny * overlap;
  const impact = Math.abs(a.speed - b.speed);
  if (a._shoveWith === b.id && now - (a._shoveAt || 0) < 0.35) return 0;
  a._shoveWith = b.id; a._shoveAt = now;
  b._shoveWith = a.id; b._shoveAt = now;
  const faster = Math.abs(a.speed) >= Math.abs(b.speed) ? a : b;
  const slower = faster === a ? b : a;
  // Shove the slower car away from the faster one, along its own heading
  // if that points away, or in reverse if it faces into the push. The shove
  // is slightly harder than the faster car's speed so a rammed parked car
  // shoots ahead instead of pinning the driver behind it at a crawl.
  const fx = Math.cos(slower.angle), fy = Math.sin(slower.angle);
  const awayX = slower === b ? nx : -nx;
  const awayY = slower === b ? ny : -ny;
  const facingAway = fx * awayX + fy * awayY > 0;
  const shove = Math.min(160, Math.abs(faster.speed) * 1.05);
  // A car shoved backwards only bounces back a little: a full-reverse
  // launch leaves the driver fighting inverted steering for seconds.
  slower.speed = facingAway ? shove : -Math.min(60, shove);
  faster.speed *= 0.92;
  return impact;
}

export function nearestCar(game, x, y, maxDist, kinds) {
  let best = null, bd = maxDist;
  for (const car of game.cars) {
    if (kinds && !kinds.includes(car.kind)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
