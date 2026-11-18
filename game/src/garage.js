// Solmar Heat — garage.js
// Rico's Garage and the Safehouse, the two places that make Solmar feel
// like home. The garage sells cars for cash: G cycles the stock on offer,
// E buys the one on display (the sports car only sells to drivers with
// rep 20+). A bought car is parked in the garage lot as an owned car —
// Rico can take it any time without drawing heat, and owned cars persist
// in the save. The safehouse clears the wanted level: stand inside it for
// a few seconds and the heat is gone, progress saved.

import { TUNING, LANDMARKS, REP_SPORTS_CAR } from './config.js';
import { makeCar } from './traffic.js';
import { setMessage } from './missions.js';

export function createGarage() {
  return {
    display: 0,          // which stock car is on display
    cycleT: 0,
  };
}

export function garageStock() {
  return TUNING.garageStock;
}

export function displayCar(game) {
  return garageStock()[game.garage.display % garageStock().length];
}

export function nearGarage(game) {
  const p = game.player;
  if (p.inCar || p.inHeli) return false;
  return Math.hypot(p.x - LANDMARKS.garage.x, p.y - LANDMARKS.garage.y) < 80;
}

export function nearSafehouse(game) {
  const p = game.player;
  if (p.inCar || p.inHeli) return false;
  return Math.hypot(p.x - LANDMARKS.safehouse.x, p.y - LANDMARKS.safehouse.y) < 70;
}

export function cycleGarage(game) {
  game.garage.display = (game.garage.display + 1) % garageStock().length;
  const car = displayCar(game);
  setMessage(game, `${car.type.toUpperCase()} — $${car.price}`, 2);
  game.audio.blip();
}

export function buyDisplayedCar(game) {
  const p = game.player;
  const car = displayCar(game);
  if (car.type === 'sports' && game.rep < REP_SPORTS_CAR) {
    setMessage(game, `The sports car needs REP ${REP_SPORTS_CAR}+ — do more jobs first.`, 4);
    game.audio.denied();
    return false;
  }
  if (p.cash < car.price) {
    setMessage(game, `Not enough cash — the ${car.type} is $${car.price}.`, 4);
    game.audio.denied();
    return false;
  }
  p.cash -= car.price;
  const owned = {
    type: car.type,
    color: car.color,
    x: LANDMARKS.garage.x + 60 + game.ownedCars.length * 90,
    y: LANDMARKS.garage.y + 60,
    angle: 0,
  };
  game.ownedCars.push(owned);
  spawnOwnedCar(game, owned);
  setMessage(game, `${car.type.toUpperCase()} bought! It is parked in the garage lot.`, 4);
  game.audio.missionDone();
  game.save();
  return true;
}

// Put an owned car in the world as a parked car Rico can take for free.
export function spawnOwnedCar(game, owned) {
  const car = makeCar('owned', owned.type, owned.x, owned.y, owned.angle, owned.color);
  car.owned = true;
  game.cars.push(car);
  return car;
}

export function updateGarage(game, dt) {
  game.garage.cycleT = Math.max(0, game.garage.cycleT - dt);
  // Safehouse: stand inside for a few seconds and the heat clears.
  // The timer only runs while Rico is actually wanted.
  if (nearSafehouse(game) && game.wanted > 0) {
    game.safeT += dt;
    if (game.safeT > 0 && game.safeT < TUNING.safehouseClearTime) {
      setMessage(game, `Laying low at the safehouse… ${Math.ceil(TUNING.safehouseClearTime - game.safeT)}s`, 1);
    }
    if (game.safeT >= TUNING.safehouseClearTime) {
      game.wanted = 0;
      game.bustTimer = 0;
      game.cops = [];
      game.cars = game.cars.filter((c) => c.kind !== 'police');
      setMessage(game, 'Heat cleared — the safehouse hid you. Progress saved.', 4);
      game.audio.missionDone();
      game.save();
      game.safeT = -999; // don't re-trigger until Rico leaves and comes back
    }
  } else {
    game.safeT = 0;
  }
}
