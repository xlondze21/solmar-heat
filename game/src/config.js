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
  bustHoldTime: 3.5,      // seconds a cop must sit on a near-stopped player to bust them
  bustLossFrac: 0.2,      // cash lost when busted
  bustLossMin: 50,
  wastedLoss: 100,
  trafficCount: 14,
  parkedCount: 14,
  pedCount: 26,
  copChaseRange: 1400,
  dayLength: 240,         // seconds for a full day/dusk cycle
  // Helicopters.
  heliMaxSpeed: 300,
  heliAccel: 170,
  heliClimb: 150,
  heliMaxAlt: 240,
  heliHp: 100,
  heliSpawnWanted: 3,    // police heli shows up at this many stars
  heliRotorDps: 1400,    // rotor spin, degrees per second (visual)
  // Garage + safehouse.
  safehouseClearTime: 3, // seconds inside to clear the heat
  garageStock: [
    { type: 'sports', price: 800, color: '#22c1a3' },
    { type: 'taxi', price: 350, color: '#f2c230' },
    { type: 'truck', price: 500, color: '#6b7c8a' },
  ],
};

// In-car radio: three synthesized stations (WebAudio loops, no audio files).
export const RADIO_STATIONS = [
  { name: 'SOLMAR FM 88.5', tag: 'chill', bpm: 96,  root: 220.00, scale: [0, 3, 5, 7, 10] },
  { name: 'NEON 101', tag: 'drive', bpm: 128, root: 246.94, scale: [0, 2, 3, 7, 9] },
  { name: 'PALMA 76', tag: 'latin', bpm: 112, root: 196.00, scale: [0, 2, 4, 7, 9] },
];

// The tide: 0 = low (the beach is a wide open road), 1 = high (the sea eats
// the sand). One full cycle takes TIDE_PERIOD seconds; the water line moves
// between SAND_Y + 40 (low) and SAND_Y + 320 (high) — at high tide most of
// the beach is underwater and cars wallow.
export const TIDE_PERIOD = 360;
export const TIDE_LOW_Y = 4740;   // water line at low tide (sand fully dry)
export const TIDE_HIGH_Y = 4520;  // water line at high tide (sand drowned)

// Rival-gang territory: coloured districts on the minimap and the ground.
// Crimes committed inside a rival district draw +1 extra wanted star.
export const TERRITORIES = [
  { name: 'VIPERS', color: '#c0392b', x0: 3800, y0: 3800, x1: 4800, y1: 4480, label: 'East Docks — Vipers turf' },
  { name: 'GULLS', color: '#7d5ba6', x0: 200, y0: 200, x1: 1800, y1: 1800, label: 'Old Town — Gulls turf' },
  { name: 'PALMEROS', color: '#1e8449', x0: 200, y0: 3000, x1: 1800, y1: 4480, label: 'West Beach — Palmeros turf' },
];

// Street rep: Rico's name on the street. +10 per mission done. The garage
// sports car only sells to drivers with rep 20+ (two jobs done).
export const REP_PER_MISSION = 10;
export const REP_SPORTS_CAR = 20;

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
  {
    id: 'gullrun', name: 'The Gull Run', reward: 900,
    intro: 'The crew keeps a helicopter on the hospital pad. Fly it out over the marina and spot the smuggler boat for Marisol.',
    stages: [
      { type: 'goto', label: 'Get to the hospital helipad', x: 2820, y: 2620, radius: 80 },
      { type: 'enter-heli', label: 'Board the helicopter (press E)' },
      { type: 'goto', label: 'Fly over the marina buoy — 90s', x: 620, y: 4620, radius: 90, timer: 90 },
      { type: 'goto', label: 'Land at the Fish Market', x: 4480, y: 4380, radius: 90 },
    ],
  },
  {
    id: 'fishmarket', name: 'Fish Market Heist', reward: 750,
    intro: 'Three crates of "frozen fish" at the market, one buyer at the safehouse. Grab them, then run — 120 seconds.',
    stages: [
      { type: 'collect', label: 'Grab the 3 crates at the Fish Market', count: 3, spots: [
        { x: 4400, y: 4280 }, { x: 4580, y: 4360 }, { x: 4480, y: 4470 },
      ] },
      { type: 'goto', label: 'Get the crates to the Safehouse — 120s', x: 1000, y: 3400, radius: 70, timer: 120 },
    ],
  },
  {
    id: 'tiderunner', name: 'Tide Runner', reward: 1000,
    intro: 'The tide is out and the beach is an open highway. Three flags down the sand — 45 seconds each. When the sea comes back, the road is gone.',
    setTide: 0.05,
    stages: [
      { type: 'goto', label: 'Flag 1: West Beach — 45s', x: 800, y: 4580, radius: 80, timer: 45 },
      { type: 'goto', label: 'Flag 2: Mid Beach — 45s', x: 2400, y: 4580, radius: 80, timer: 45 },
      { type: 'goto', label: 'Flag 3: East Beach — 45s', x: 4200, y: 4580, radius: 80, timer: 45 },
    ],
  },
  {
    id: 'decodash', name: 'Deco Dash', reward: 1200,
    intro: 'Neon night in the old town. Four checkpoints through the art-deco streets, 70 seconds each. The whole quarter is watching.',
    setTimeOfDay: 0.52,
    stages: [
      { type: 'goto', label: 'Checkpoint 1: Palm Court — 70s', x: 1400, y: 200, radius: 80, timer: 70 },
      { type: 'goto', label: 'Checkpoint 2: Deco Row — 70s', x: 220, y: 1400, radius: 80, timer: 70 },
      { type: 'goto', label: 'Checkpoint 3: Old Theatre — 70s', x: 1400, y: 1400, radius: 80, timer: 70 },
      { type: 'goto', label: 'Finish: Marina Gate — 70s', x: 240, y: 4380, radius: 80, timer: 70 },
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
  helipad: { x: 2820, y: 2620, label: 'Helipad' },
  garage: { x: 1400, y: 3400, label: 'Rico\'s Garage' },
  safehouse: { x: 1000, y: 3400, label: 'Safehouse' },
  respawn: { x: 2600, y: 2500 },
};

export const SAVE_KEY = 'solmar-heat-save-v2';
