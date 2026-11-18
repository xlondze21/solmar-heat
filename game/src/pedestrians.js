// Solmar Heat — pedestrians.js
// People of Solmar: they stroll the sidewalks, cross at corners, and run
// when a car bears down on them or a shot rings out. Hitting one is a crime.

import { ROAD_CENTERS, ROAD_W, TUNING } from './config.js';
import { nearestRoadIndex, collideBuildings, clampToWorld } from './world.js';

const SHIRTS = ['#e8e8e8', '#f2a541', '#5aa469', '#c95f7a', '#7a9cc9', '#e07840', '#9a6bc9', '#3d3d3d'];
const PANTS = ['#2c3e50', '#5d4037', '#37474f', '#6b7c8a'];

export function spawnPeds(game, count) {
  const rng = game.rng;
  const peds = [];
  for (let n = 0; n < count; n++) {
    const vertical = rng.chance(0.5);
    const road = ROAD_CENTERS[rng.int(0, ROAD_CENTERS.length - 1)];
    const along = rng.range(200, 4400);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = ROAD_W / 2 + 14;
    peds.push({
      x: vertical ? road + side * off : along,
      y: vertical ? along : road + side * off,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(55, 95),
      state: 'walk', // 'walk' | 'flee' | 'down'
      stateT: 0,
      axis: vertical ? 'v' : 'h',
      dir: rng.chance(0.5) ? 1 : -1,
      road,
      shirt: rng.pick(SHIRTS),
      pants: rng.pick(PANTS),
      seed: rng.next(),
    });
  }
  return peds;
}

export function scarePeds(game, x, y, radius) {
  for (const p of game.peds) {
    if (p.state === 'down') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.state = 'flee';
      p.stateT = 2.5;
      p.fleeX = x;
      p.fleeY = y;
    }
  }
}

function walkStep(game, p, dt) {
  // Stroll along the sidewalk; at a corner, sometimes turn onto the cross street.
  const along = p.axis === 'v' ? p.y : p.x;
  const cross = p.axis === 'v' ? p.x : p.y;
  const crossIdx = nearestRoadIndex(cross);
  const nextCross = ROAD_CENTERS[p.dir > 0 ? Math.min(crossIdx + 1, ROAD_CENTERS.length - 1) : Math.max(crossIdx - 1, 0)];
  const distToCorner = Math.abs(nextCross - along);
  if (distToCorner < 12 && game.rng.chance(0.35)) {
    p.axis = p.axis === 'v' ? 'h' : 'v';
    p.road = nearestRoadIndex(p.axis === 'v' ? p.x : p.y);
    p.dir = game.rng.chance(0.5) ? 1 : -1;
  }
  const heading = p.axis === 'v' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
  p.angle = heading;
  p.x += Math.cos(heading) * p.speed * dt;
  p.y += Math.sin(heading) * p.speed * dt;
  // Stay on the sidewalk line.
  const off = ROAD_W / 2 + 14;
  const lane = p.axis === 'v' ? p.road + (p.dir > 0 ? -off : off) : p.road + (p.dir > 0 ? off : -off);
  if (p.axis === 'v') p.x += (lane - p.x) * Math.min(1, 2 * dt);
  else p.y += (lane - p.y) * Math.min(1, 2 * dt);
  if (p.y > 4460) { p.y = 4460; p.dir *= -1; }
}

export function updatePeds(game, dt) {
  for (const p of game.peds) {
    if (p.state === 'down') {
      p.stateT -= dt;
      if (p.stateT <= 0) { p.state = 'flee'; p.stateT = 3; p.fleeX = game.player.x; p.fleeY = game.player.y; }
      continue;
    }
    if (p.state === 'flee') {
      p.stateT -= dt;
      const a = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
      p.angle = a;
      p.x += Math.cos(a) * 300 * dt;
      p.y += Math.sin(a) * 300 * dt;
      if (p.stateT <= 0) {
        p.state = 'walk';
        p.axis = game.rng.chance(0.5) ? 'v' : 'h';
        p.road = nearestRoadIndex(p.axis === 'v' ? p.x : p.y);
        p.dir = game.rng.chance(0.5) ? 1 : -1;
      }
    } else {
      walkStep(game, p, dt);
    }
    collideBuildings(game.city, p, 12);
    clampToWorld(p, 12);
  }
}
