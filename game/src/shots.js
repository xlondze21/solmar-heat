// Solmar Heat — shots.js
// Deterministic screenshot scenes for ?shot=cover|drive|mission|chase&seed=1.
// Each scene builds a fixed setup from the seeded RNG, runs 40 fixed steps
// so traffic and cops are mid-motion, then freezes — the headless shell
// screenshots a stable, readable frame of the real game.

import { CAR_TYPES } from './config.js';
import { makeCar, spawnTraffic, spawnParked } from './traffic.js';
import { spawnPeds } from './pedestrians.js';
import { jumpToStage } from './missions.js';

export const SHOT_NAMES = ['cover', 'drive', 'mission', 'chase'];

function freshStreets(game) {
  game.cars = [];
  game.cops = [];
  game.peds = [];
  game.particles = [];
  game.skids = [];
  game.tracers = [];
  game.cars.push(...spawnTraffic(game, 12));
  game.cars.push(...spawnParked(game, 10));
  game.peds = spawnPeds(game, 22);
}

function placePlayerCar(game, type, x, y, angle, color, speed) {
  const car = makeCar('player', type, x, y, angle, color);
  car.speed = speed;
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

function placeCop(game, x, y, angle, speed) {
  const cop = makeCar('police', 'police', x, y, angle, '#1d3fae');
  cop.speed = speed;
  cop.cruise = CAR_TYPES.police.maxSpeed;
  game.cars.push(cop);
  game.cops.push(cop);
  return cop;
}

function runSteps(game, steps, throttle) {
  if (throttle) game.input.hold('KeyW');
  for (let i = 0; i < steps; i++) game.update(1 / 60);
  if (throttle) game.input.release('KeyW');
}

function skidTrail(game, x, y, angle, n) {
  for (let i = 0; i < n; i++) {
    game.addSkid(x - Math.cos(angle) * i * 26, y - Math.sin(angle) * i * 26 + (i % 2 ? 8 : -8), angle);
  }
}

export function setupShot(game, name) {
  game.state = 'playing';
  game.time = 0;
  game.busted = false;
  game.bustTimer = 0;
  game.wantedNoteT = 0;
  freshStreets(game);

  if (name === 'cover') {
    // Dusk police chase on the beachfront road: the money shot.
    game.timeOfDay = 0.52;
    jumpToStage(game, 0, 1); // "Pick up Marisol at the Marina"
    game.missions.done = [false, false, false, false];
    placePlayerCar(game, 'sports', 2350, 4600, 0, '#e83e8c', 300);
    placeCop(game, 2130, 4592, 0, 315);
    placeCop(game, 2040, 4628, 0.12, 305);
    skidTrail(game, 2200, 4600, 0, 8);
    game.addParticle(2140, 4592, '#ffb347', 10);
    runSteps(game, 40, true);
    game.wanted = 3;
    game.cops = game.cops.slice(0, 2);
  } else if (name === 'drive') {
    // Daytime cruise through the city grid, traffic all around.
    game.timeOfDay = 0.15;
    jumpToStage(game, 0, 0);
    game.missions.done = [false, false, false, false];
    placePlayerCar(game, 'sedan', 1400, 1000, 0, '#3d7ac9', 235);
    // A few neighbours on the same road so the cruise reads as traffic.
    const t1 = makeCar('traffic', 'taxi', 1720, 1015, 0, '#f2c230');
    t1.axis = 'h'; t1.dir = 1; t1.road = 2; t1.speed = 150; t1.cruise = 160;
    const t2 = makeCar('traffic', 'truck', 1080, 985, Math.PI, '#8a6d4b');
    t2.axis = 'h'; t2.dir = -1; t2.road = 2; t2.speed = 110; t2.cruise = 120;
    const t3 = makeCar('traffic', 'sedan', 2050, 1015, 0, '#c94f3d');
    t3.axis = 'h'; t3.dir = 1; t3.road = 2; t3.speed = 170; t3.cruise = 175;
    game.cars.push(t1, t2, t3);
    runSteps(game, 40, true);
    game.wanted = 0;
    game.cops = [];
    game.cars = game.cars.filter((c) => c.kind !== 'police');
  } else if (name === 'mission') {
    // On foot at the Marina, pickup marker overhead, taxi waiting.
    game.timeOfDay = 0.2;
    jumpToStage(game, 0, 1);
    game.missions.done = [false, false, false, false];
    game.player.inCar = null;
    game.player.x = 330;
    game.player.y = 4310;
    game.player.angle = Math.atan2(4380 - 4310, 240 - 330);
    game.player.ammo = 12;
    game.camera.x = 330;
    game.camera.y = 4310;
    const taxi = makeCar('parked', 'taxi', 430, 4380, Math.PI / 2, '#f2c230');
    game.cars.push(taxi);
    runSteps(game, 40, false);
    game.wanted = 0;
    game.cops = [];
    game.cars = game.cars.filter((c) => c.kind !== 'police');
  } else if (name === 'chase') {
    // Second action shot: taxi boxed in by three cruisers at dusk.
    game.timeOfDay = 0.55;
    game.missions.done = [true, false, false, false];
    jumpToStage(game, 1, 0); // "Pick up the package at the Docks"
    placePlayerCar(game, 'taxi', 3000, 2200, -Math.PI / 2, '#f2c230', 315);
    placeCop(game, 2950, 2470, -Math.PI / 2, 320);
    placeCop(game, 3075, 2420, -Math.PI / 2 + 0.2, 318);
    placeCop(game, 2915, 2300, -Math.PI / 2 - 0.15, 310);
    skidTrail(game, 3000, 2320, -Math.PI / 2, 7);
    game.addParticle(2970, 2400, '#ffb347', 12);
    runSteps(game, 40, true);
    game.wanted = 4;
    game.cops = game.cops.slice(0, 3);
  } else {
    // Unknown shot name: fall back to the drive scene.
    return setupShot(game, 'drive');
  }

  // Freeze the frame: no more updates, the shell screenshots this state.
  game.frozen = true;
  game.bustTimer = 0;
  const p = game.player;
  game.camera.x = p.inCar ? p.inCar.x : p.x;
  game.camera.y = p.inCar ? p.inCar.y : p.y;
}
