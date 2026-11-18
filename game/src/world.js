// Solmar Heat — world.js
// The city itself: a road grid, building blocks, the south beach, traffic
// lights, landmarks. Pure data + geometry helpers; no drawing here.

import { WORLD_W, WORLD_H, ROAD_W, ROAD_CENTERS, SAND_Y, WATER_Y, LANDMARKS } from './config.js';

const BUILDING_COLORS = ['#c98a5e', '#7fa3b8', '#b87f8a', '#8aa87f', '#c9b458', '#9a8ac9', '#d8d8d8', '#e0a080'];
const ROOF_COLORS = ['#3a3f47', '#4a3a3a', '#37474f', '#5d4037'];

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  // One or two buildings per block, kept off the roads and off the beach.
  for (let i = 0; i < ROAD_CENTERS.length - 1; i++) {
    for (let j = 0; j < ROAD_CENTERS.length - 1; j++) {
      const x0 = ROAD_CENTERS[i] + ROAD_W / 2 + 8;
      const y0 = ROAD_CENTERS[j] + ROAD_W / 2 + 8;
      const x1 = ROAD_CENTERS[i + 1] - ROAD_W / 2 - 8;
      const y1 = ROAD_CENTERS[j + 1] - ROAD_W / 2 - 8;
      if (y0 > SAND_Y - 40) continue; // beach blocks stay open
      const count = rng.chance(0.3) ? 1 : 2;
      for (let k = 0; k < count; k++) {
        const w = rng.range(90, 150);
        const h = rng.range(80, 140);
        const bx = count === 1
          ? x0 + (x1 - x0 - w) / 2
          : x0 + (k * (x1 - x0 - w)) + rng.range(0, 20);
        const by = y0 + rng.range(0, Math.max(1, y1 - y0 - h));
        buildings.push({
          x: bx, y: by, w, h,
          color: rng.pick(BUILDING_COLORS),
          roof: rng.pick(ROOF_COLORS),
          floors: rng.int(1, 4),
          windows: rng.int(2, 5),
        });
      }
    }
  }
  // Palm trees along the beachfront road.
  for (let x = 120; x < WORLD_W - 100; x += rng.range(110, 190)) {
    palms.push({ x, y: SAND_Y + rng.range(24, 60), s: rng.range(0.8, 1.3) });
    if (rng.chance(0.5)) palms.push({ x: x + 40, y: SAND_Y - 70, s: rng.range(0.7, 1.1) });
  }
  // Traffic lights at every second intersection, phases offset per corner.
  const lights = [];
  for (let i = 0; i < ROAD_CENTERS.length; i += 2) {
    for (let j = 0; j < ROAD_CENTERS.length; j += 2) {
      lights.push({ x: ROAD_CENTERS[i], y: ROAD_CENTERS[j], offset: (i * 0.13 + j * 0.07) % 1 });
    }
  }
  return { buildings, palms, lights, gunShop: LANDMARKS.gunShop, hospital: LANDMARKS.hospital };
}

// --- geometry helpers -------------------------------------------------------

export function isRoadAt(x, y) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) <= ROAD_W / 2) return true;
    if (Math.abs(y - c) <= ROAD_W / 2) return true;
  }
  return false;
}

export function nearestRoadIndex(v) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < ROAD_CENTERS.length; i++) {
    const d = Math.abs(v - ROAD_CENTERS[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Green for north-south traffic when phase < 0.5, else green for east-west.
export function lightPhase(light, time) {
  return (time * 0.045 + light.offset) % 1;
}
export function lightIsGreen(light, time, axis) {
  const p = lightPhase(light, time);
  return axis === 'v' ? p < 0.5 : p >= 0.5;
}
export function nearestLight(city, x, y) {
  let best = null, bd = Infinity;
  for (const l of city.lights) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

// Push a circle (entity with x, y, radius r) out of every building it overlaps.
// Returns true when a collision happened.
export function collideBuildings(city, e, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        e.x = cx + (dx / d) * r;
        e.y = cy + (dy / d) * r;
      } else {
        e.y = b.y - r; // centre inside the rect: shove it out the top
      }
    }
  }
  return hit;
}

export function clampToWorld(e, r) {
  e.x = Math.max(r, Math.min(WORLD_W - r, e.x));
  e.y = Math.max(r, Math.min(WORLD_H - r, e.y));
  if (e.y > WATER_Y - r) e.y = WATER_Y - r; // the sea is not drivable
}

export function inWater(x, y) { return y >= WATER_Y; }
export function inSand(x, y) { return y >= SAND_Y && y < WATER_Y; }

// A point on a road centreline near (x, y): used for spawning cars and cops.
export function snapToRoad(rng, x, y) {
  const xi = nearestRoadIndex(x);
  const yj = nearestRoadIndex(y);
  if (Math.abs(x - ROAD_CENTERS[xi]) <= Math.abs(y - ROAD_CENTERS[yj])) {
    return { x: ROAD_CENTERS[xi], y, axis: 'v', road: xi };
  }
  return { x, y: ROAD_CENTERS[yj], axis: 'h', road: yj };
}
