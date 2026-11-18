// Solmar Heat — render.js
// Every pixel of the city: ground, roads, beach, buildings, cars, people,
// skid marks, smoke, sparks, and the day/dusk light. Reads game state only.

import { WORLD_W, WORLD_H, ROAD_CENTERS, ROAD_W, SAND_Y, WATER_Y, PALETTE } from './config.js';
import { lightPhase } from './world.js';
import { missionMarker } from './missions.js';

// How much of the golden-hour tint is on (0 = noon, 1 = full dusk).
export function duskFactor(game) {
  const t = game.timeOfDay; // 0..1 across the day
  const d = 1 - Math.min(1, Math.abs(t - 0.52) / 0.22);
  return Math.max(0, d);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function visible(game) {
  const cam = game.camera, v = game.view;
  return {
    x0: cam.x - v.w / 2 / cam.zoom - 80,
    y0: cam.y - v.h / 2 / cam.zoom - 80,
    x1: cam.x + v.w / 2 / cam.zoom + 80,
    y1: cam.y + v.h / 2 / cam.zoom + 80,
  };
}

function drawGround(game, ctx, vis) {
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(vis.x0, vis.y0, vis.x1 - vis.x0, vis.y1 - vis.y0);
  // Sidewalk blocks: slightly lighter squares between the roads.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let i = 0; i < ROAD_CENTERS.length - 1; i++) {
    for (let j = 0; j < ROAD_CENTERS.length - 1; j++) {
      const x0 = ROAD_CENTERS[i] + ROAD_W / 2;
      const y0 = ROAD_CENTERS[j] + ROAD_W / 2;
      const x1 = ROAD_CENTERS[i + 1] - ROAD_W / 2;
      const y1 = ROAD_CENTERS[j + 1] - ROAD_W / 2;
      if (x1 < vis.x0 || x0 > vis.x1 || y1 < vis.y0 || y0 > vis.y1) continue;
      if (y0 > SAND_Y) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Beach sand and water along the south edge.
  if (vis.y1 > SAND_Y) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(vis.x0, Math.max(vis.y0, SAND_Y), vis.x1 - vis.x0, WATER_Y - Math.max(vis.y0, SAND_Y));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(vis.x0, Math.max(vis.y0, WATER_Y), vis.x1 - vis.x0, WORLD_H - Math.max(vis.y0, WATER_Y));
    ctx.fillStyle = PALETTE.waterDeep;
    const t = game.time * 0.7;
    for (let x = Math.floor(vis.x0 / 90) * 90; x < vis.x1; x += 90) {
      const yy = WATER_Y + 26 + Math.sin(t + x * 0.01) * 6;
      ctx.fillRect(x, yy, 54, 3);
    }
  }
  // Roads: dark asphalt bands with dashed centre lines.
  ctx.fillStyle = PALETTE.road;
  for (const c of ROAD_CENTERS) {
    if (c + ROAD_W / 2 > vis.x0 && c - ROAD_W / 2 < vis.x1) ctx.fillRect(c - ROAD_W / 2, vis.y0, ROAD_W, vis.y1 - vis.y0);
    if (c + ROAD_W / 2 > vis.y0 && c - ROAD_W / 2 < vis.y1) ctx.fillRect(vis.x0, c - ROAD_W / 2, vis.x1 - vis.x0, ROAD_W);
  }
  ctx.fillStyle = PALETTE.roadLine;
  const dash = 26, gap = 30;
  for (const c of ROAD_CENTERS) {
    for (let d = Math.floor(vis.y0 / (dash + gap)) * (dash + gap); d < vis.y1; d += dash + gap) {
      if (c > vis.x0 && c < vis.x1) ctx.fillRect(c - 2, d, 4, dash);
    }
    for (let d = Math.floor(vis.x0 / (dash + gap)) * (dash + gap); d < vis.x1; d += dash + gap) {
      if (c > vis.y0 && c < vis.y1) ctx.fillRect(d, c - 2, dash, 4);
    }
  }
}

function drawBuildings(game, ctx, vis) {
  const dusk = duskFactor(game);
  for (const b of game.city.buildings) {
    if (b.x + b.w < vis.x0 || b.x > vis.x1 || b.y + b.h < vis.y0 || b.y > vis.y1) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows glow at dusk.
    ctx.fillStyle = dusk > 0.25 ? '#ffd76a' : 'rgba(20,24,32,0.55)';
    const cols = b.windows, rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const wx = b.x + 12 + (i * (b.w - 24)) / Math.max(1, cols - 1 || 1);
        const wy = b.y + 14 + (j * (b.h - 28)) / Math.max(1, rows - 1 || 1);
        ctx.fillRect(wx, wy, 7, 9);
      }
    }
  }
  // Palm trees on the beachfront.
  for (const p of game.city.palms) {
    if (p.x < vis.x0 || p.x > vis.x1 || p.y < vis.y0 || p.y > vis.y1) continue;
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 4 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 4 * p.s, p.y - 16 * p.s);
    ctx.stroke();
    ctx.fillStyle = '#2f8f4e';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(p.x + 4 * p.s + Math.cos(a) * 10 * p.s, p.y - 16 * p.s + Math.sin(a) * 6 * p.s, 11 * p.s, 4 * p.s, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLights(game, ctx, vis) {
  for (const l of game.city.lights) {
    if (l.x < vis.x0 || l.x > vis.x1 || l.y < vis.y0 || l.y > vis.y1) continue;
    const p = lightPhase(l, game.time);
    ctx.fillStyle = '#222';
    ctx.fillRect(l.x - 26, l.y - 26, 10, 18);
    ctx.fillStyle = p < 0.5 ? '#37d67a' : '#e5484d';
    ctx.beginPath();
    ctx.arc(l.x - 21, l.y - 17, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p < 0.5 ? '#e5484d' : '#37d67a';
    ctx.beginPath();
    ctx.arc(l.x + 21, l.y + 17, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gun shop marker.
  const g = game.city.gunShop;
  if (g.x > vis.x0 && g.x < vis.x1 && g.y > vis.y0 && g.y < vis.y1) {
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#1f9d55';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', g.x, g.y + 30);
  }
  // Mission marker + collectible drops.
  const marker = missionMarker(game);
  if (marker) {
    const bob = Math.sin(game.time * 5) * 5;
    ctx.save();
    ctx.translate(marker.x, marker.y + bob - 26);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.strokeStyle = 'rgba(242,194,48,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y);
    ctx.lineTo(marker.x, marker.y - 52 + bob);
    ctx.stroke();
  }
  for (const s of game.missions.remainingSpots || []) {
    const bob = Math.sin(game.time * 4 + s.x) * 4;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a00';
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCarShape(ctx, car, dusk) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const l = car.len, w = car.wid;
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-l / 2 + 8, -w / 2 - 3, 14, 6);
  ctx.fillRect(-l / 2 + 8, w / 2 - 3, 14, 6);
  ctx.fillRect(l / 2 - 22, -w / 2 - 3, 14, 6);
  ctx.fillRect(l / 2 - 22, w / 2 - 3, 14, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -l / 2, -w / 2, l, w, 9);
  ctx.fill();
  // Police livery.
  if (car.type === 'police') {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-l / 2 + 12, -w / 2, l - 24, w);
    ctx.fillStyle = '#1d3fae';
    ctx.fillRect(-6, -w / 2 + 2, 12, w - 4);
    const flash = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath(); ctx.arc(-4, -w / 2 + 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.beginPath(); ctx.arc(6, -w / 2 + 1, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Windshield + roof + rear window.
  ctx.fillStyle = 'rgba(15,20,28,0.85)';
  ctx.fillRect(l / 2 - 24, -w / 2 + 5, 10, w - 10);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(-8, -w / 2 + 5, 18, w - 10);
  ctx.fillStyle = 'rgba(15,20,28,0.85)';
  ctx.fillRect(-l / 2 + 6, -w / 2 + 5, 8, w - 10);
  // Taxi sign.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -5, 14, 10);
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 1, 2);
  }
  // Headlights at dusk.
  if (dusk > 0.2) {
    ctx.fillStyle = 'rgba(255,240,170,0.95)';
    ctx.beginPath(); ctx.arc(l / 2 - 2, -w / 2 + 7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(l / 2 - 2, w / 2 - 7, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Damage smoke.
  if (car.smoke) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(-l / 2 + 4, 0, 7 + Math.sin(performance.now() / 90) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.state === 'down') {
    ctx.rotate(1.2);
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(p.seed * 40 + performance.now() / 130) * 1.5;
  ctx.fillStyle = p.pants;
  ctx.fillRect(-3, -2 + bob, 6, 9);
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, -6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 2, -6 + Math.sin(p.angle) * 2, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar) return; // the car drawing carries the player
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const bob = Math.sin(performance.now() / 140) * 1.2;
  // Rico: white tee, dark jeans, red cap.
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-3, -2 + bob, 7, 10);
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.arc(0, -6, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c94f3d';
  ctx.beginPath(); ctx.arc(0, -7, 5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(2, -6, 3.6, 0, Math.PI * 2); ctx.fill();
  // Punch swing.
  if (p.punchAnim > 0) {
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(20, -4);
    ctx.stroke();
  }
  // Aim line when holding the pistol.
  if (p.ammo > 0 && !p.inCar) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(46, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEffects(game, ctx) {
  // Skid marks.
  for (const s of game.skids) {
    ctx.strokeStyle = `rgba(12,12,14,${0.55 * (s.life / s.max)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
  // Particles: smoke grey, sparks orange, blood red, cash gold.
  for (const pt of game.particles) {
    const a = Math.max(0, pt.life / pt.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (1 + (1 - a) * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Muzzle tracers.
  for (const t of game.tracers) {
    ctx.strokeStyle = `rgba(255,220,90,${Math.max(0, t.life / 0.12)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
}

export function renderGame(game, ctx) {
  const v = game.view;
  const cam = game.camera;
  ctx.clearRect(0, 0, v.w, v.h);
  ctx.save();
  // Screen shake on crashes.
  if (game.shake > 0.2) {
    ctx.translate((game.rng.next() - 0.5) * game.shake, (game.rng.next() - 0.5) * game.shake);
  }
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + v.w / 2 / cam.zoom, -cam.y + v.h / 2 / cam.zoom);
  const vis = visible(game);
  const dusk = duskFactor(game);
  drawGround(game, ctx, vis);
  drawBuildings(game, ctx, vis);
  drawLights(game, ctx, vis);
  drawEffects(game, ctx);
  for (const car of game.cars) {
    if (car.x < vis.x0 || car.x > vis.x1 || car.y < vis.y0 || car.y > vis.y1) continue;
    drawCarShape(ctx, car, dusk);
  }
  // Player's car gets a white outline so it reads at a glance.
  if (game.player.inCar) {
    const car = game.player.inCar;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.len / 2 - 3, -car.wid / 2 - 3, car.len + 6, car.wid + 6, 11);
    ctx.stroke();
    ctx.restore();
  }
  for (const p of game.peds) {
    if (p.x < vis.x0 || p.x > vis.x1 || p.y < vis.y0 || p.y > vis.y1) continue;
    drawPed(ctx, p);
  }
  drawPlayer(ctx, game);
  ctx.restore();

  // Dusk tint + vignette over everything.
  if (dusk > 0.02) {
    ctx.fillStyle = `rgba(255,110,40,${0.10 * dusk})`;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.fillStyle = `rgba(8,10,40,${0.20 * dusk})`;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  const grad = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.42, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, v.w, v.h);
}
