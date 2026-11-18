// Solmar Heat — shots.js
// Deterministic screenshot scenes for ?shot=cover|drive|mission|chase&seed=1.
// Each scene builds a fixed setup from the seeded RNG, runs 40 fixed steps
// so traffic and cops are mid-motion, then freezes — the headless shell
// screenshots a stable, readable frame of the real game.

import { CAR_TYPES } from './config.js';
import { makeCar, spawnTraffic, spawnParked } from './traffic.js';
import { spawnPeds } from './pedestrians.js';
import { jumpToStage } from './missions.js';
import { makeHeli, spawnParkedHeli } from './helicopter.js';
import { radioOn } from './radio.js';
import { waterLineY } from './world.js';

export const SHOT_NAMES = ['cover', 'drive', 'mission', 'chase'];

function freshStreets(game) {
  game.cars = [];
  game.cops = [];
  game.peds = [];
  game.helis = [];
  game.particles = [];
  game.skids = [];
  game.tracers = [];
  game.cars.push(...spawnTraffic(game, 12));
  game.cars.push(...spawnParked(game, 10));
  game.peds = spawnPeds(game, 22);
  spawnParkedHeli(game);
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
    // Dusk police chase on the beachfront road — with the PD heli overhead:
    // the money shot. 3 stars, minimap, mission objective, spotlight.
    game.timeOfDay = 0.52;
    jumpToStage(game, 4, 1); // "The Gull Run": board the helicopter
    game.missions.done = [true, true, true, true, false, false, false, false];
    placePlayerCar(game, 'sports', 2350, 4600, 0, '#e83e8c', 300);
    placeCop(game, 2130, 4592, 0, 315);
    placeCop(game, 2040, 4628, 0.12, 305);
    const heli = makeHeli('police', 2700, 4550, 0);
    heli.alt = 170;
    game.helis.push(heli);
    skidTrail(game, 2200, 4600, 0, 8);
    game.addParticle(2140, 4592, '#ffb347', 10);
    runSteps(game, 40, true);
    game.wanted = 3;
    game.cops = game.cops.slice(0, 2);
  } else if (name === 'drive') {
    // Daytime cruise through the city grid, traffic all around, radio on.
    game.timeOfDay = 0.15;
    jumpToStage(game, 0, 0);
    game.missions.done = [false, false, false, false, false, false, false, false];
    placePlayerCar(game, 'sedan', 1400, 1000, 0, '#3d7ac9', 235);
    game.radio.station = 1; // NEON 101
    radioOn(game);
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
    // Tide Runner: low tide, the beach is a wide open highway of sand.
    game.timeOfDay = 0.15;
    game.tide = 0.05;
    game.tidePhase = Math.acos(1 - 2 * 0.05) / (2 * Math.PI);
    game.waterLineY = waterLineY(game.tide);
    jumpToStage(game, 6, 0); // "Tide Runner": Flag 1, West Beach
    game.missions.done = [true, true, true, true, true, true, false, false];
    placePlayerCar(game, 'sports', 800, 4580, 0, '#22c1a3', 260);
    skidTrail(game, 700, 4580, 0, 6);
    runSteps(game, 40, true);
    game.wanted = 0;
    game.cops = [];
    game.cars = game.cars.filter((c) => c.kind !== 'police');
  } else if (name === 'chase') {
    // Deco Dash: neon dusk in the old town, taxi boxed in by three cruisers.
    game.timeOfDay = 0.55;
    game.missions.done = [true, true, true, true, true, true, true, false];
    jumpToStage(game, 7, 0); // "Deco Dash": Checkpoint 1, Palm Court
    placePlayerCar(game, 'taxi', 1000, 1000, -Math.PI / 2, '#f2c230', 315);
    placeCop(game, 950, 1270, -Math.PI / 2, 320);
    placeCop(game, 1075, 1220, -Math.PI / 2 + 0.2, 318);
    placeCop(game, 915, 1100, -Math.PI / 2 - 0.15, 310);
    skidTrail(game, 1000, 1120, -Math.PI / 2, 7);
    game.addParticle(970, 1200, '#ffb347', 12);
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
