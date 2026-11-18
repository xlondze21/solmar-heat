// Solmar Heat — main.js
// Boot + the one loop. createGame() builds the whole world and returns it
// with update(dt)/render(ctx) methods, so the headless autopilot can drive
// the same code the browser plays. The browser half only wires a canvas,
// the clock and the title screen around it.
//
// ?seed=N fixes the city. ?shot=cover|drive|mission|chase&seed=1 stages a
// frozen screenshot scene instead of the title screen.

import { WORLD_W, WORLD_H, CAR_TYPES, TUNING, LANDMARKS, SAVE_KEY, TIDE_PERIOD, TERRITORIES } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity, collideBuildings, clampToWorld, waterLineY } from './world.js';
import { makeCar, spawnTraffic, spawnParked, updateTraffic, collideCars, nearestCar } from './traffic.js';
import { spawnPeds, updatePeds, scarePeds } from './pedestrians.js';
import { updatePolice, updateWanted, addWanted } from './police.js';
import { updateHelis, enterHeli, exitHeli, nearestHeli, spawnParkedHeli } from './helicopter.js';
import { createRadio, radioOn, cycleStation, updateRadio } from './radio.js';
import { createGarage, nearGarage, nearSafehouse, cycleGarage, buyDisplayedCar, displayCar, spawnOwnedCar, updateGarage } from './garage.js';
import { createMissionState, startMission, updateMissions, retryMission, jumpToStage, currentMission, setMessage } from './missions.js';
import { tryPunch, tryShoot, nearGunShop, buyAmmo, damageCar } from './combat.js';
import { renderGame } from './render.js';
import { drawHUDAll } from './hud.js';
import { setupShot } from './shots.js';

export function createGame(opts = {}) {
  const seed = opts.seed ?? 7;
  const rng = makeRng(seed);
  const game = {
    seed,
    rng,
    time: 0,
    timeOfDay: opts.timeOfDay ?? 0.12,
    state: 'title', // 'title' | 'playing' | 'paused' | 'busted'
    frozen: false,
    started: false,
    hasSave: false,
    view: { w: 1280, h: 720 },
    camera: { x: 2600, y: 2500, zoom: 1 },
    input: new Input(),
    audio: new AudioSys(),
    city: null,
    cars: [],
    cops: [],
    peds: [],
    helis: [],
    heliDownT: 0,
    radio: createRadio(),
    garage: createGarage(),
    ownedCars: [],
    rep: 0,
    tidePhase: 0.1,      // 0..1 across TIDE_PERIOD; tide = 0.5-0.5*cos(2π·phase)
    tide: 0.1,           // 0 = low (beach dry), 1 = high (beach drowned)
    waterLineY: 4740,
    safeT: 0,
    territoryName: null,
    particles: [],
    skids: [],
    tracers: [],
    wanted: 0,
    wantedNote: '',
    wantedNoteT: 0,
    lastCrimeAt: -100,
    decayT: 0,
    bustTimer: 0,
    busted: false,
    bustedKind: 'busted',
    bustOverlayT: 0,
    shake: 0,
    copSpawnT: 0,
    crashWantedT: 0,
    pedHitT: 0,
    footHitT: 0,
    saveT: 0,
    smokeAcc: 0,
    missions: createMissionState(),
    player: {
      x: 2600, y: 2500, angle: -Math.PI / 2,
      health: TUNING.playerHealth,
      cash: TUNING.startCash,
      ammo: TUNING.startAmmo,
      inCar: null,
      inHeli: null,
      punchT: 0, punchAnim: 0, shootT: 0,
    },
  };

  game.city = buildCity(rng);
  game.cars.push(...spawnTraffic(game, TUNING.trafficCount));
  game.cars.push(...spawnParked(game, TUNING.parkedCount));
  game.peds = spawnPeds(game, TUNING.pedCount);
  spawnParkedHeli(game);
  game.waterLineY = waterLineY(game.tide);

  // --- helpers --------------------------------------------------------------
  game.addWanted = (n, reason) => addWanted(game, n, reason);

  game.addParticle = (x, y, color, n) => {
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2;
      const sp = rng.range(20, 95);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rng.range(0.35, 0.85), max: 0.85,
        color, size: rng.range(2, 5),
      });
    }
  };

  game.addTracer = (x, y, angle) => {
    game.tracers.push({ x1: x, y1: y, x2: x + Math.cos(angle) * 430, y2: y + Math.sin(angle) * 430, life: 0.12 });
  };

  game.addSkid = (x, y, angle) => {
    game.skids.push({ x, y, angle, life: 6, max: 6 });
    if (game.skids.length > 220) game.skids.splice(0, game.skids.length - 220);
  };

  game.crashAt = (x, y, hard) => {
    game.shake = Math.min(16, game.shake + (hard ? 11 : 5));
    game.audio.crash(hard);
    game.addParticle(x, y, '#ffb347', hard ? 14 : 7);
    game.addParticle(x, y, '#888888', hard ? 8 : 4);
  };

  // --- save / load ------------------------------------------------------------
  game.save = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: game.player.cash,
        ammo: game.player.ammo,
        health: game.player.health,
        x: game.player.x, y: game.player.y,
        missionIndex: game.missions.index,
        missionStage: game.missions.stage,
        done: game.missions.done,
        timeOfDay: game.timeOfDay,
        rep: game.rep,
        ownedCars: game.ownedCars,
      }));
    } catch { /* storage full or blocked: play on without a save */ }
  };

  game.loadSave = () => {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  game.applySave = (data) => {
    game.player.cash = data.cash;
    game.player.ammo = data.ammo;
    game.player.health = data.health;
    game.player.x = data.x;
    game.player.y = data.y;
    game.player.inCar = null;
    game.player.inHeli = null;
    game.timeOfDay = data.timeOfDay ?? 0.12;
    game.rep = data.rep ?? 0;
    const done = data.done || [];
    game.missions.done = Array.from({ length: 8 }, (_, i) => !!done[i]);
    game.ownedCars = data.ownedCars || [];
    for (const owned of game.ownedCars) spawnOwnedCar(game, owned);
    jumpToStage(game, Math.min(data.missionIndex ?? 0, 7), data.missionStage ?? 0);
    game.camera.x = data.x;
    game.camera.y = data.y;
  };

  // Fresh game, same seed, already playing. Returns the new object because
  // the game's methods close over the object createGame built.
  game.reset = () => {
    const fresh = createGame({ seed: game.seed, timeOfDay: 0.12 });
    fresh.state = 'playing';
    return fresh;
  };

  // --- bust / wasted ----------------------------------------------------------
  function endRun(kind, loss) {
    const p = game.player;
    if (p.inCar) {
      p.inCar.kind = p.inCar.owned ? 'owned' : 'parked';
      p.inCar.speed = 0;
      p.inCar = null;
    }
    if (p.inHeli) {
      p.inHeli.kind = 'parked';
      p.inHeli.alt = 0;
      p.inHeli.vx = 0; p.inHeli.vy = 0; p.inHeli.speed = 0;
      p.inHeli = null;
    }
    p.cash = Math.max(0, p.cash - loss);
    game.wanted = 0;
    game.bustTimer = 0;
    game.cops = [];
    // Busted or wasted mid-job: the job fails, GTA-style. Getting caught must
    // never "complete" an escape — the heat has to be lost on your own terms.
    const cur = currentMission(game.missions);
    if (cur) {
      game.missions.failed = true;
      setMessage(game, `${kind === 'busted' ? 'BUSTED' : 'WASTED'} — ${cur.name} failed. Press M to retry.`, 6);
    }
    game.cars = game.cars.filter((c) => c.kind !== 'police');
    game.helis = game.helis.filter((h) => h.kind === 'parked');
    game.bustedKind = kind;
    game.state = 'busted';
    game.bustOverlayT = 3;
    game.audio.busted();
    game.save();
  }

  game.handleBust = () => {
    const loss = Math.max(TUNING.bustLossMin, Math.floor(game.player.cash * TUNING.bustLossFrac));
    endRun('busted', loss);
  };

  game.handleWasted = () => {
    endRun('wasted', Math.min(game.player.cash, TUNING.wastedLoss));
  };

  game.respawn = () => {
    const p = game.player;
    p.x = LANDMARKS.respawn.x;
    p.y = LANDMARKS.respawn.y;
    p.angle = -Math.PI / 2;
    p.health = TUNING.playerHealth;
    p.inCar = null;
    game.camera.x = p.x;
    game.camera.y = p.y;
    game.state = 'playing';
    game.save();
  };

  // --- player -----------------------------------------------------------------
  function updatePlayerOnFoot(game, dt) {
    const p = game.player;
    const axis = game.input.moveAxis();
    const len = Math.hypot(axis.x, axis.y);
    if (len > 0) {
      p.angle = Math.atan2(axis.y, axis.x);
      p.x += (axis.x / len) * TUNING.walkSpeed * dt;
      p.y += (axis.y / len) * TUNING.walkSpeed * dt;
      collideBuildings(game.city, p, 13);
      clampToWorld(p, 13);
    }
    if (game.input.pressed('KeyE')) {
      if (nearGunShop(game)) {
        buyAmmo(game);
      } else if (nearGarage(game)) {
        buyDisplayedCar(game);
      } else {
        const heli = nearestHeli(game, p.x, p.y, 80, ['parked']);
        if (heli) {
          enterHeli(game, heli);
        } else {
          const car = nearestCar(game, p.x, p.y, 78, ['traffic', 'parked', 'police', 'owned']);
          if (car) enterCar(game, car);
        }
      }
    }
    if (game.input.pressed('KeyG') && nearGarage(game)) cycleGarage(game);
    if (game.input.pressed('KeyF')) tryPunch(game);
    if (game.input.mouse.clicked) tryShoot(game);
  }

  function enterCar(game, car) {
    const p = game.player;
    if (car.kind === 'police') {
      game.addWanted(2, 'Cruiser jacked!');
      game.cops = game.cops.filter((c) => c !== car);
    } else if (car.kind === 'owned') {
      // Rico's own car: no heat, it is his.
    } else {
      game.addWanted(TUNING.stealWanted, 'Car stolen');
    }
    if (car.kind === 'traffic') scarePeds(game, car.x, car.y, 150);
    car.kind = 'player';
    car.hp = Math.max(car.hp, 200); // a fresh steal is in good shape — a chase car has to survive one
    car.axis = Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle)) ? 'h' : 'v';
    car.dir = (car.axis === 'h' ? Math.cos(car.angle) : Math.sin(car.angle)) > 0 ? 1 : -1;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    game.audio.blip();
    radioOn(game);
  }

  function exitCar(game) {
    const p = game.player;
    const car = p.inCar;
    if (!car) return;
    car.kind = car.owned ? 'owned' : 'parked';
    car.speed = 0;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    p.angle = car.angle;
    p.inCar = null;
    collideBuildings(game.city, p, 13);
    clampToWorld(p, 13);
  }

  function updatePlayerDriving(game, dt) {
    const p = game.player;
    const car = p.inCar;
    const spec = CAR_TYPES[car.type];
    const prevSpeed = car.speed;
    const input = game.input;
    if (input.throttle) car.speed = Math.min(spec.maxSpeed, car.speed + spec.accel * dt);
    else if (input.brake) {
      if (car.speed > 25) car.speed = Math.max(0, car.speed - spec.brake * dt);
      else car.speed = Math.max(-spec.maxSpeed * 0.35, car.speed - spec.accel * 0.55 * dt);
    } else {
      const drag = 55 * dt;
      car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
    }
    if (input.handbrake && Math.abs(car.speed) > 60) {
      car.speed *= Math.max(0, 1 - 2.4 * dt);
      const bx = car.x - Math.cos(car.angle) * (car.len / 2);
      const by = car.y - Math.sin(car.angle) * (car.len / 2);
      game.addSkid(bx, by, car.angle);
      game.addParticle(bx, by, '#cccccc', 1);
    }
    const steerAuthority = Math.min(1, Math.max(0.3, Math.abs(car.speed) / 70)) * (car.speed < 0 ? -1 : 1);
    car.angle += input.steer * spec.turn * steerAuthority * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Sand drag: the beach is an open road, but it is still sand.
    if (car.y > 4480 && car.y < game.waterLineY && Math.abs(car.speed) > spec.maxSpeed * 0.75) {
      car.speed = Math.sign(car.speed) * spec.maxSpeed * 0.75;
    }
    if (collideBuildings(game.city, car, 20)) {
      if (Math.abs(prevSpeed) > 210) {
        game.crashAt(car.x, car.y, Math.abs(prevSpeed) > 300);
        damageCar(game, car, Math.abs(prevSpeed) * 0.015);
        // Only a very hard wall hit hurts Rico himself — the car's HP is
        // the real penalty for a crash, and a police chase must not waste
        // him by ramming alone.
        if (Math.abs(prevSpeed) > 350) p.health -= 3;
      }
      // A gentle touch just slides along the wall (the push-out above keeps
      // the car out of the bricks); only a fast hit costs speed.
      if (Math.abs(prevSpeed) > 120) car.speed *= 0.45;
    }
    clampToWorld(car, 24, game.waterLineY);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (game.input.pressed('KeyE')) exitCar(game);
    if (game.input.pressed('KeyR')) cycleStation(game);
  }

  function updatePlayer(game, dt) {
    const p = game.player;
    p.punchT = Math.max(0, p.punchT - dt);
    p.punchAnim = Math.max(0, p.punchAnim - dt);
    p.shootT = Math.max(0, p.shootT - dt);
    if (p.inHeli) {
      // Flying: E exits only once landed (exitHeli enforces the altitude).
      if (game.input.pressed('KeyE')) exitHeli(game);
    } else if (p.inCar) updatePlayerDriving(game, dt);
    else updatePlayerOnFoot(game, dt);
    if (game.input.pressed('KeyM') && game.missions.failed) retryMission(game);
  }

  // --- collisions ---------------------------------------------------------------
  function updateCarCollisions(game) {
    const cars = game.cars;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        const impact = collideCars(a, b, game.time);
        if (impact > 140) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          game.crashAt(mx, my, impact > 260);
          // A cruiser ramming the player's car is trying to stop it, not
          // total it: police damage to the player's car is cut to an eighth,
          // so a chase is survivable and the bust stays the real threat.
          // (A cruiser sitting on a stuck car still grinds its HP down, so
          // the driver has to keep moving — but it takes a long while.)
          const policeRam = (a.kind === 'police' && b === game.player.inCar)
            || (b.kind === 'police' && a === game.player.inCar);
          const dmg = impact * (policeRam ? 0.0015 : 0.012);
          damageCar(game, a, dmg);
          damageCar(game, b, dmg);
          const playerCar = a === game.player.inCar ? a : b === game.player.inCar ? b : null;
          const other = playerCar === a ? b : a;
          if (playerCar && game.crashWantedT <= 0) {
            // Hitting a cruiser only counts when Rico is the one doing the
            // ramming (faster than the cruiser). A cruiser rear-ending a
            // fleeing Rico must not raise his heat — that made every chase
            // spiral to 5 stars on its own.
            if (other.kind === 'police' && Math.abs(playerCar.speed) > Math.abs(other.speed)) game.addWanted(TUNING.copHitWanted, 'You hit a cruiser!');
            // A scrape is not a hit-and-run: only a real shunt draws heat.
            else if (other.kind === 'traffic' && impact > 220) game.addWanted(1, 'Hit and run');
            game.crashWantedT = 3;
          }
          // A hard shunt costs Rico a little health — but only a little:
          // the car's HP is the real penalty, and being rammed by cruisers
          // in a chase must not waste him on its own.
          if (playerCar && impact > 350) game.player.health -= 2;
        }
      }
    }
    // Player's car vs pedestrians.
    const p = game.player;
    if (p.inCar && Math.abs(p.inCar.speed) > 70) {
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y) < 28) {
          ped.state = 'down';
          ped.stateT = 3;
          scarePeds(game, ped.x, ped.y, 260);
          if (game.pedHitT <= 0) {
            game.addWanted(TUNING.pedHitWanted, 'Pedestrian down!');
            game.pedHitT = 1.5;
          }
          game.crashAt(ped.x, ped.y, false);
          p.inCar.speed *= 0.85;
        }
      }
    }
    // Moving cars vs the player on foot.
    if (!p.inCar) {
      for (const car of game.cars) {
        if (car.kind === 'parked' || Math.abs(car.speed) < 40) continue;
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < 30) {
          const a = Math.atan2(p.y - car.y, p.x - car.x);
          p.x = car.x + Math.cos(a) * 30;
          p.y = car.y + Math.sin(a) * 30;
          // One hit per second at most: without the cooldown a single
          // passing car drains the whole health bar in under a second.
          if (game.footHitT <= 0) {
            p.health -= 6;
            game.footHitT = 1;
            game.shake = Math.max(game.shake, 8);
            game.audio.crash(false);
          }
        }
      }
    }
  }

  // --- effects ------------------------------------------------------------------
  function updateEffects(game, dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const pt = game.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      if (pt.life <= 0) game.particles.splice(i, 1);
    }
    for (let i = game.skids.length - 1; i >= 0; i--) {
      game.skids[i].life -= dt;
      if (game.skids[i].life <= 0) game.skids.splice(i, 1);
    }
    for (let i = game.tracers.length - 1; i >= 0; i--) {
      game.tracers[i].life -= dt;
      if (game.tracers[i].life <= 0) game.tracers.splice(i, 1);
    }
    game.shake = Math.max(0, game.shake - dt * 26);
    // Damage smoke puffs from wrecked cars.
    game.smokeAcc += dt;
    if (game.smokeAcc > 0.14) {
      game.smokeAcc = 0;
      for (const car of game.cars) {
        if (car.smoke) game.addParticle(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, '#777777', 1);
      }
    }
  }

  function updateCamera(game, dt) {
    const p = game.player;
    const tx = p.inCar ? p.inCar.x : p.x;
    const ty = p.inCar ? p.inCar.y : p.y;
    const k = Math.min(1, 5 * dt);
    game.camera.x += (tx - game.camera.x) * k;
    game.camera.y += (ty - game.camera.y) * k;
    const hw = game.view.w / 2 / game.camera.zoom;
    const hh = game.view.h / 2 / game.camera.zoom;
    game.camera.x = Math.max(hw, Math.min(WORLD_W - hw, game.camera.x));
    game.camera.y = Math.max(hh, Math.min(WORLD_H - hh, game.camera.y));
  }

  // --- master step ----------------------------------------------------------------
  game.update = (dt) => {
    if (game.frozen) return;
    if (game.state === 'busted') {
      game.bustOverlayT -= dt;
      updateEffects(game, dt);
      if (game.bustOverlayT <= 0) game.respawn();
      game.input.endFrame();
      return;
    }
    if (game.state !== 'playing') {
      game.input.endFrame();
      return;
    }
    game.time += dt;
    game.timeOfDay = (game.timeOfDay + dt / TUNING.dayLength) % 1;
    // The tide: a slow cosine cycle; the water line follows it.
    game.tidePhase = (game.tidePhase + dt / TIDE_PERIOD) % 1;
    game.tide = 0.5 - 0.5 * Math.cos(2 * Math.PI * game.tidePhase);
    game.waterLineY = waterLineY(game.tide);
    game.crashWantedT = Math.max(0, game.crashWantedT - dt);
    game.pedHitT = Math.max(0, game.pedHitT - dt);
    game.footHitT = Math.max(0, game.footHitT - dt);
    game.wantedNoteT = Math.max(0, game.wantedNoteT - dt);
    if (game.input.pressed('KeyP') || game.input.pressed('Escape')) {
      game.state = 'paused';
      game.save();
      game.input.endFrame();
      return;
    }
    updatePlayer(game, dt);
    updateTraffic(game, dt);
    updatePeds(game, dt);
    updatePolice(game, dt);
    updateHelis(game, dt);
    updateWanted(game, dt);
    updateMissions(game, dt);
    updateRadio(game, dt);
    updateGarage(game, dt);
    // Rival territory: name the turf the player is standing in.
    {
      const p = game.player;
      let zone = null;
      for (const t of TERRITORIES) {
        if (p.x >= t.x0 && p.x <= t.x1 && p.y >= t.y0 && p.y <= t.y1) { zone = t; break; }
      }
      const name = zone ? zone.name : null;
      if (name !== game.territoryName) {
        game.territoryName = name;
        if (zone) game.missions.message = zone.label, game.missions.messageT = 3;
      }
    }
    updateCarCollisions(game);
    updateEffects(game, dt);
    updateCamera(game, dt);
    const p = game.player;
    const speed01 = p.inCar ? Math.abs(p.inCar.speed) / CAR_TYPES[p.inCar.type].maxSpeed : 0;
    game.audio.setEngine(speed01, !!p.inCar);
    game.audio.setSiren(game.wanted > 0);
    game.saveT += dt;
    if (game.saveT > 10) { game.saveT = 0; game.save(); }
    if (game.busted) {
      game.busted = false;
      game.handleBust();
    } else if (p.health <= 0) {
      game.handleWasted();
    }
    game.input.endFrame();
  };

  game.render = (ctx) => {
    renderGame(game, ctx);
    drawHUDAll(game, ctx);
  };

  return game;
}

// --- browser boot -----------------------------------------------------------------

export function startBrowserGame() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 7);
  const game = createGame({ seed });
  game.input.attach(canvas);

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    game.view.w = canvas.width;
    game.view.h = canvas.height;
  };
  window.addEventListener('resize', resize);
  resize();

  game.hasSave = !!game.loadSave();

  const shot = params.get('shot');
  if (shot) {
    setupShot(game, shot);
    game.render(ctx);
  } else {
    game.state = 'title';
  }

  const onGesture = () => { game.audio.ensure(); game.audio.resume(); };
  window.addEventListener('keydown', onGesture);
  window.addEventListener('mousedown', onGesture);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (game.frozen) {
      game.render(ctx);
    } else if (game.state === 'title') {
      game.time += dt; // keeps the title blink alive
      if (game.input.pressed('Enter') || game.input.mouse.clicked) {
        onGesture();
        game.state = 'playing';
        game.started = true;
        startMission(game, 0);
      } else if (game.input.pressed('KeyC') && game.hasSave) {
        onGesture();
        const data = game.loadSave();
        if (data) game.applySave(data);
        game.state = 'playing';
        game.started = true;
      }
      game.input.endFrame();
      game.render(ctx);
    } else if (game.state === 'paused') {
      if (game.input.pressed('KeyP') || game.input.pressed('Escape') || game.input.pressed('Enter')) {
        game.state = 'playing';
      }
      game.input.endFrame();
      game.render(ctx);
    } else {
      game.update(dt);
      game.render(ctx);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return game;
}

if (typeof document !== 'undefined') {
  startBrowserGame();
}
