// Solmar Heat — config.js
// One place for every number that tunes the city, the cars and the cops.
// Nothing here touches the DOM, so the headless autopilot can import it too.

export const WORLD_W = 4800;
export const WORLD_H = 4800;

// City grid: roads every 400 px, 84 px wide, centred on these lines.
export const ROAD_GAP = 400;
export const ROAD_W = 84;
export const ROAD_CENTERS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800, 4200, 4600];

// South edge is the beach: sand, then open water the player cannot enter.
export const SAND_Y = 4480;
export const WATER_Y = 4700;

export const TILE = 64;

// Palette — sun-soaked coastal city, warm asphalt, pastel buildings.
export const PALETTE = {
  ground: '#3b4148',
  sidewalk: '#565d66',
  road: '#23262b',
  roadLine: '#e8d44d',
  sand: '#e2c98d',
  water: '#1d6f8f',
  waterDeep: '#155a75',
  buildingRoof: '#2c2f36',
  grass: '#4a7a4f',
};

// Vehicle bodies. len/wid are pixels; speeds are px per second.
export const CAR_TYPES = {
  sedan:  { len: 74, wid: 34, maxSpeed: 265, accel: 150, brake: 320, turn: 2.7, colors: ['#c94f3d', '#3d7ac9', '#d8d8d8', '#5aa469'] },
  taxi:   { len: 74, wid: 34, maxSpeed: 270, accel: 155, brake: 320, turn: 2.7, colors: ['#f2c230'] },
  truck:  { len: 104, wid: 38, maxSpeed: 195, accel: 95,  brake: 240, turn: 1.9, colors: ['#8a6d4b', '#6b7c8a', '#a33d31'] },
  sports: { len: 76, wid: 34, maxSpeed: 345, accel: 210, brake: 360, turn: 3.1, colors: ['#e83e8c', '#22c1a3', '#f26522'] },
  police: { len: 76, wid: 34, maxSpeed: 325, accel: 195, brake: 350, turn: 3.0, colors: ['#1d3fae'] },
};

export const TUNING = {
  walkSpeed: 195,
  playerHealth: 100,
  startCash: 120,
  startAmmo: 12,
  ammoPrice: 50,
  ammoPack: 24,
  pistolRange: 430,
  pistolDamage: 34,
  punchRange: 46,
  punchDamage: 18,
  stealWanted: 1,
  pedHitWanted: 1,
  shootWanted: 1,
  copHitWanted: 1,
  maxWanted: 5,
  wantedDecayDelay: 20,   // seconds without a crime before stars start falling
  wantedDecayStep: 8,     // seconds per star once decaying
  bustHoldTime: 2.5,      // seconds a cop must sit on a slow player to bust them
  bustLossFrac: 0.2,      // cash lost when busted
  bustLossMin: 50,
  wastedLoss: 100,
  trafficCount: 14,
  parkedCount: 14,
  pedCount: 26,
  copChaseRange: 1400,
  dayLength: 240,         // seconds for a full day/dusk cycle
};

// Mission script — Rico, a driver for hire in Solmar.
export const MISSIONS = [
  {
    id: 'fare', name: 'First Fare', reward: 300,
    intro: 'Marisol needs a ride. Grab a car, pick her up at the Marina.',
    stages: [
      { type: 'enter-car', label: 'Steal or take a car (walk up and press E)' },
      { type: 'goto', label: 'Pick up Marisol at the Marina', x: 240, y: 4380, radius: 70 },
      { type: 'goto', label: 'Drop her at the Solmar Hotel — 75s', x: 2600, y: 620, radius: 70, timer: 75 },
    ],
  },
  {
    id: 'delivery', name: 'Hot Delivery', reward: 400,
    intro: 'A package at the Docks. No questions, no stops. 90 seconds.',
    stages: [
      { type: 'goto', label: 'Pick up the package at the Docks', x: 4550, y: 4380, radius: 70 },
      { type: 'goto', label: 'Deliver to the North Tower — 90s', x: 4380, y: 260, radius: 70, timer: 90 },
    ],
  },
  {
    id: 'heat', name: 'Lose the Heat', reward: 500,
    intro: 'The crew wants to know you can shake a tail. Get 2 stars, then vanish.',
    stages: [
      { type: 'wanted', label: 'Raise your wanted level to 2 stars', min: 2 },
      { type: 'escape', label: 'Lose the cops — drop back to 0 stars' },
    ],
  },
  {
    id: 'turf', name: 'Turf Pickup', reward: 600,
    intro: 'Three drops stashed around Solmar. Collect them all. Heads will turn.',
    stages: [
      { type: 'collect', label: 'Collect the 3 drops around Solmar', count: 3, spots: [
        { x: 620, y: 2620 }, { x: 3420, y: 1820 }, { x: 1820, y: 3820 },
      ] },
    ],
  },
];

export const LANDMARKS = {
  marina: { x: 240, y: 4380, label: 'Marina' },
  hotel: { x: 2600, y: 620, label: 'Solmar Hotel' },
  docks: { x: 4550, y: 4380, label: 'Docks' },
  northTower: { x: 4380, y: 260, label: 'North Tower' },
  gunShop: { x: 1020, y: 1020, label: 'AMMU-NATION' },
  hospital: { x: 2600, y: 2600, label: 'Solmar General' },
  respawn: { x: 2600, y: 2500 },
};

export const SAVE_KEY = 'solmar-heat-save-v1';
