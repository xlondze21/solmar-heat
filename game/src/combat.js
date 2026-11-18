// Solmar Heat — combat.js
// Fists and the pistol. Punch on foot (F), aim with the mouse and click to
// shoot. Ammo is scarce: buy more at the gun shop marker. Shooting and
// hitting people both draw the cops.

import { TUNING, LANDMARKS } from './config.js';
import { scarePeds } from './pedestrians.js';
import { addWanted } from './police.js';
import { damageHeli } from './helicopter.js';

export function aimAngle(game) {
  // Mouse position on screen -> world angle from the player.
  const p = game.player;
  const cam = game.camera;
  const wx = cam.x + (game.input.mouse.x - game.view.w / 2) / cam.zoom;
  const wy = cam.y + (game.input.mouse.y - game.view.h / 2) / cam.zoom;
  return Math.atan2(wy - p.y, wx - p.x);
}

export function tryPunch(game) {
  const p = game.player;
  if (p.inCar || p.punchT > 0) return;
  p.punchT = 0.45;
  p.punchAnim = 0.25;
  game.audio.punch();
  const range = TUNING.punchRange;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < range) {
      ped.state = 'down';
      ped.stateT = 2.5;
      scarePeds(game, p.x, p.y, 220);
      game.addParticle(ped.x, ped.y, '#ffffff', 6);
      return;
    }
  }
  // A punch can dent a car too.
  for (const car of game.cars) {
    if (Math.hypot(car.x - p.x, car.y - p.y) < range + 20) {
      damageCar(game, car, TUNING.punchDamage);
      return;
    }
  }
}

export function tryShoot(game) {
  const p = game.player;
  if (p.inCar || p.shootT > 0 || p.ammo <= 0) {
    if (p.ammo <= 0 && p.shootT <= 0) { game.audio.denied(); p.shootT = 0.3; }
    return;
  }
  p.ammo -= 1;
  p.shootT = 0.28;
  game.audio.shot();
  addWanted(game, TUNING.shootWanted, 'Shots fired');
  scarePeds(game, p.x, p.y, 420);
  const angle = aimAngle(game);
  game.addTracer(p.x, p.y, angle);
  // Hit the closest thing inside a narrow cone in front of the muzzle.
  const range = TUNING.pistolRange;
  let best = null, bestD = range;
  const consider = (x, y, obj) => {
    const dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range) return;
    const a = Math.atan2(dy, dx);
    let diff = Math.abs(a - angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.12 && d < bestD) { bestD = d; best = obj; }
  };
  for (const ped of game.peds) if (ped.state !== 'down') consider(ped.x, ped.y, { kind: 'ped', ped });
  for (const car of game.cars) consider(car.x, car.y, { kind: 'car', car });
  // The police heli is a fair target too: bring it down and the PD backs off.
  for (const heli of game.helis) {
    if (heli.kind !== 'police' || heli.crashing || heli.gone) continue;
    consider(heli.x, heli.y, { kind: 'heli', heli });
  }
  if (!best) return;
  if (best.kind === 'ped') {
    best.ped.state = 'down';
    best.ped.stateT = 4;
    game.addParticle(best.ped.x, best.ped.y, '#ff5555', 10);
  } else if (best.kind === 'heli') {
    damageHeli(game, best.heli, TUNING.pistolDamage);
    game.addParticle(best.heli.x, best.heli.y, '#ffb347', 10);
  } else {
    damageCar(game, best.car, TUNING.pistolDamage);
    game.addParticle(best.car.x, best.car.y, '#ffb347', 10);
  }
}

export function damageCar(game, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && !car.disabled) {
    car.disabled = true;
    car.speed = 0;
    game.addParticle(car.x, car.y, '#555555', 22);
    game.addParticle(car.x, car.y, '#ff8833', 14);
    game.audio.crash(true);
    if (car === game.player.inCar) {
      game.player.inCar = null; // the wreck throws Rico out
      game.player.x = car.x + 50;
      game.player.y = car.y;
    }
  } else if (car.hp < 40) {
    car.smoke = 1;
  }
}

// Gun shop: stand on the marker on foot and press E to buy a box of ammo.
export function nearGunShop(game) {
  const p = game.player;
  if (p.inCar) return false;
  return Math.hypot(p.x - LANDMARKS.gunShop.x, p.y - LANDMARKS.gunShop.y) < 70;
}

export function buyAmmo(game) {
  const p = game.player;
  if (p.cash < TUNING.ammoPrice) { game.audio.denied(); return false; }
  p.cash -= TUNING.ammoPrice;
  p.ammo += TUNING.ammoPack;
  game.audio.blip();
  return true;
}
