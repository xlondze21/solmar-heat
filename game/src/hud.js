// Solmar Heat — hud.js
// The HUD: cash, health, wanted stars, ammo, speed, mission tracker, the
// minimap, prompts, and the title / pause / busted screens. All 2D canvas.

import { WORLD_W, WORLD_H, TUNING, LANDMARKS, TERRITORIES, RADIO_STATIONS } from './config.js';
import { objectiveText, currentMission } from './missions.js';
import { nearGunShop } from './combat.js';
import { nearestCar } from './traffic.js';
import { nearestHeli } from './helicopter.js';
import { nearGarage, nearSafehouse, displayCar } from './garage.js';
import { currentStation } from './radio.js';

const CONTROLS = [
  ['W A S D / Arrows', 'Walk / drive'],
  ['E', 'Enter / exit car · board heli · buy at garage'],
  ['Mouse + Click', 'Aim / shoot pistol'],
  ['F', 'Punch'],
  ['Space', 'Handbrake · climb (heli)'],
  ['Shift', 'Descend (heli)'],
  ['R', 'Radio station'],
  ['G', 'Cycle garage stock'],
  ['P / Esc', 'Pause'],
  ['M', 'Retry mission'],
];

export function drawMinimap(game, ctx, x, y, size) {
  const s = size / WORLD_W;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  // Water + sand — the water line rides the tide.
  ctx.fillStyle = '#1d6f8f';
  ctx.fillRect(0, (game.waterLineY / WORLD_H) * size, size, size - (game.waterLineY / WORLD_H) * size);
  ctx.fillStyle = '#e2c98d';
  ctx.fillRect(0, (4480 / WORLD_H) * size, size, ((game.waterLineY - 4480) / WORLD_H) * size);
  // Rival turf tints.
  for (const tr of TERRITORIES) {
    ctx.fillStyle = tr.color + '55';
    ctx.fillRect(tr.x0 * s, tr.y0 * s, (tr.x1 - tr.x0) * s, (tr.y1 - tr.y0) * s);
  }
  // Roads.
  ctx.strokeStyle = 'rgba(200,205,215,0.5)';
  ctx.lineWidth = 2;
  for (const c of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800, 4200, 4600]) {
    ctx.beginPath(); ctx.moveTo(c * s, 0); ctx.lineTo(c * s, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c * s); ctx.lineTo(size, c * s); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = 'rgba(150,160,175,0.55)';
  for (const b of game.city.buildings) {
    ctx.fillRect(b.x * s, b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
  }
  // Mission marker (pulsing).
  const m = game.missions;
  const stage = currentMission(m) ? currentMission(m).stages[m.stage] : null;
  let mx = null, my = null;
  if (stage && stage.type === 'goto') { mx = stage.x; my = stage.y; }
  else if (stage && stage.type === 'collect' && m.remainingSpots.length) { mx = m.remainingSpots[0].x; my = m.remainingSpots[0].y; }
  if (mx !== null) {
    const pulse = 4 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.arc(mx * s, my * s, pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Gun shop.
  ctx.fillStyle = '#37d67a';
  ctx.fillRect(LANDMARKS.gunShop.x * s - 2, LANDMARKS.gunShop.y * s - 2, 4, 4);
  // Garage (orange), safehouse (green), helipad (purple).
  ctx.fillStyle = '#f26522';
  ctx.fillRect(LANDMARKS.garage.x * s - 2, LANDMARKS.garage.y * s - 2, 4, 4);
  ctx.fillStyle = '#37d67a';
  ctx.fillRect(LANDMARKS.safehouse.x * s - 2, LANDMARKS.safehouse.y * s - 2, 4, 4);
  ctx.fillStyle = '#7a5cff';
  ctx.fillRect(LANDMARKS.helipad.x * s - 2, LANDMARKS.helipad.y * s - 2, 4, 4);
  // Traffic (grey), cops (blue), helis (red ring), player (white ring).
  ctx.fillStyle = 'rgba(220,220,220,0.7)';
  for (const car of game.cars) {
    if (car.kind === 'traffic' || car.kind === 'parked' || car.kind === 'owned') ctx.fillRect(car.x * s - 1, car.y * s - 1, 2, 2);
  }
  ctx.fillStyle = '#2d6bff';
  for (const cop of game.cops) {
    ctx.beginPath(); ctx.arc(cop.x * s, cop.y * s, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#ff2d2d';
  ctx.lineWidth = 2;
  for (const heli of game.helis) {
    if (heli.kind !== 'police') continue;
    ctx.beginPath(); ctx.arc(heli.x * s, heli.y * s, 4, 0, Math.PI * 2); ctx.stroke();
  }
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px * s, py * s, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(px * s, py * s, 3.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function star(ctx, x, y, r, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#f2c230' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHUD(game, ctx) {
  const v = game.view;
  const p = game.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: cash + health + street rep.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(14, 12, 218, 84);
  ctx.fillStyle = '#7CFC00';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 42);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('RICO  ·  SOLMAR', 26, 62);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(150, 48, 70, 9);
  ctx.fillStyle = p.health > 30 ? '#37d67a' : '#e5484d';
  ctx.fillRect(150, 48, 70 * (p.health / 100), 9);
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 12px sans-serif';
  const repStars = '★'.repeat(Math.min(8, Math.floor(game.rep / 10))) + '☆'.repeat(Math.max(0, 8 - Math.min(8, Math.floor(game.rep / 10))));
  ctx.fillText(`REP ${game.rep} ${repStars}`, 26, 86);
  // Tide gauge under the cash box: LOW on the left, HIGH on the right.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(14, 102, 218, 30);
  ctx.fillStyle = '#7fb8d8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(game.tide < 0.33 ? 'TIDE: LOW — beach road open' : game.tide < 0.66 ? 'TIDE: RISING' : 'TIDE: HIGH — beach drowned', 26, 116);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(14, 124, 218, 5);
  ctx.fillStyle = '#1d6f8f';
  ctx.fillRect(14, 124, 218 * game.tide, 5);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(v.w - 208, 12, 194, 44);
  for (let i = 0; i < 5; i++) star(ctx, v.w - 186 + i * 34, 34, 12, i < game.wanted);
  if (game.wantedNoteT > 0) {
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(game.wantedNote, v.w - 20, 76);
  }
  // Bottom-left: minimap + district label (or the turf Rico is standing in).
  drawMinimap(game, ctx, 14, v.h - 184, 170);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(game.territoryName ? `${game.territoryName} TURF — rival ground` : 'SOLMAR — SOUTH BEACH', 14, v.h - 192);
  // Bottom-centre: mission tracker.
  const obj = objectiveText(game.missions);
  ctx.font = 'bold 15px sans-serif';
  const tw = ctx.measureText(obj).width;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  ctx.fillRect(v.w / 2 - tw / 2 - 14, v.h - 52, tw + 28, 32);
  ctx.fillStyle = '#f2c230';
  ctx.textAlign = 'center';
  ctx.fillText(obj, v.w / 2, v.h - 31);
  // Message banner.
  if (game.missions.messageT > 0) {
    ctx.font = 'bold 17px sans-serif';
    const mw = ctx.measureText(game.missions.message).width;
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    ctx.fillRect(v.w / 2 - mw / 2 - 16, 74, mw + 32, 34);
    ctx.fillStyle = '#fff';
    ctx.fillText(game.missions.message, v.w / 2, 97);
  }
  // Bottom-right: speed / altitude / ammo — plus the radio station.
  const st = currentStation(game.radio);
  if (st && p.inCar) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.fillRect(v.w - 238, v.h - 64, 92, 50);
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪ ' + st.name, v.w - 192, v.h - 32);
  }
  if (p.inHeli) {
    const heli = p.inHeli;
    const mph = Math.round(heli.speed * 0.22);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.fillRect(v.w - 138, v.h - 64, 124, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${mph}`, v.w - 58, v.h - 30);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('MPH', v.w - 26, v.h - 30);
    ctx.font = '12px sans-serif';
    ctx.fillText(`ALT ${Math.round(heli.alt)}`, v.w - 26, v.h - 48);
  } else if (p.inCar) {
    const mph = Math.round(Math.abs(p.inCar.speed) * 0.22);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.fillRect(v.w - 138, v.h - 64, 124, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${mph}`, v.w - 58, v.h - 30);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('MPH', v.w - 26, v.h - 30);
    ctx.font = '12px sans-serif';
    ctx.fillText(p.inCar.type.toUpperCase(), v.w - 26, v.h - 48);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.fillRect(v.w - 138, v.h - 64, 124, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`PISTOL  ${p.ammo}`, v.w - 26, v.h - 32);
    ctx.font = '12px sans-serif';
    ctx.fillText('F — PUNCH', v.w - 26, v.h - 48);
  }
  // Context prompt.
  let prompt = '';
  if (p.inHeli) {
    prompt = p.inHeli.alt > 25 ? 'Space — Climb   ·   Shift — Descend' : 'E — Exit helicopter   ·   Space — Climb   ·   Shift — Descend';
  } else if (!p.inCar) {
    const heli = nearestHeli(game, p.x, p.y, 80, ['parked']);
    const car = nearestCar(game, p.x, p.y, 78, ['traffic', 'parked', 'police', 'owned']);
    if (nearGunShop(game)) prompt = `E — Buy ammo ${TUNING.ammoPack} rounds ($${TUNING.ammoPrice})`;
    else if (nearGarage(game)) {
      const dc = displayCar(game);
      prompt = `E — Buy ${dc.type.toUpperCase()} $${dc.price}   ·   G — Next car`;
    } else if (nearSafehouse(game)) prompt = 'Safehouse — lay low to clear the heat';
    else if (heli) prompt = 'E — Board the helicopter';
    else if (car) prompt = car.kind === 'police' ? 'E — Jack the police cruiser (+2★)' : car.kind === 'owned' ? 'E — Take your car' : 'E — Enter car';
  } else {
    prompt = 'E — Exit car   ·   Space — Handbrake   ·   R — Radio';
  }
  if (game.missions.failed) prompt = 'M — Retry mission';
  if (prompt) {
    ctx.font = 'bold 14px sans-serif';
    const pw = ctx.measureText(prompt).width;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect(v.w / 2 - pw / 2 - 12, v.h - 96, pw + 24, 28);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, v.w / 2, v.h - 77);
  }
}

function overlay(ctx, v, alpha) {
  ctx.fillStyle = `rgba(5,8,14,${alpha})`;
  ctx.fillRect(0, 0, v.w, v.h);
}

export function drawTitle(game, ctx) {
  const v = game.view;
  overlay(ctx, v, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 74px sans-serif';
  ctx.fillText('SOLMAR HEAT', v.w / 2, v.h / 2 - 150);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 20px sans-serif';
  ctx.fillText('A sun-soaked open-world crime story', v.w / 2, v.h / 2 - 112);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#d8dce2';
  ctx.fillText('You are Rico, a driver for hire. Eight jobs for the Solmar crew stand between', v.w / 2, v.h / 2 - 74);
  ctx.fillText('you and the top — if the Solmar PD lets you get there.', v.w / 2, v.h / 2 - 52);
  // Controls table.
  ctx.font = '14px sans-serif';
  let y = v.h / 2 - 8;
  for (const [key, what] of CONTROLS) {
    ctx.fillStyle = '#f2c230';
    ctx.textAlign = 'right';
    ctx.fillText(key, v.w / 2 - 12, y);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(what, v.w / 2 + 12, y);
    y += 24;
  }
  const blink = Math.floor(game.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.hasSave ? 'ENTER — START    ·    C — CONTINUE SAVED GAME' : 'PRESS ENTER OR CLICK TO START', v.w / 2, v.h / 2 + 196);
  }
  ctx.fillStyle = '#8a929e';
  ctx.font = '12px sans-serif';
  ctx.fillText('Original game. No real city, person or brand appears in Solmar.', v.w / 2, v.h - 24);
}

export function drawPause(game, ctx) {
  const v = game.view;
  overlay(ctx, v, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', v.w / 2, v.h / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillText('P / Esc — resume    ·    progress saved', v.w / 2, v.h / 2 + 26);
}

export function drawBusted(game, ctx, kind) {
  const v = game.view;
  overlay(ctx, v, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#2d6bff' : '#e5484d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED!', v.w / 2, v.h / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText(kind === 'busted' ? 'The Solmar PD took your cut. You walk out at the hospital.' : 'You wake up at Solmar General, lighter in the pocket.', v.w / 2, v.h / 2 + 28);
}

export function drawStoryComplete(game, ctx) {
  const v = game.view;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('★ STORY COMPLETE — SOLMAR IS YOURS ★', v.w / 2, 128);
}

export function drawHUDAll(game, ctx) {
  drawHUD(game, ctx);
  if (game.missions.index >= 8) drawStoryComplete(game, ctx);
  if (game.state === 'paused') drawPause(game, ctx);
  if (game.state === 'busted') drawBusted(game, ctx, game.bustedKind);
  if (game.state === 'title') drawTitle(game, ctx);
}
