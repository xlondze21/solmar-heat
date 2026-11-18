// Solmar Heat — missions.js
// Rico's story: four jobs for the Solmar crew, played in order. Each mission
// is a list of stages (enter a car, drive to a marker, beat a timer, raise
// then lose the heat, collect drops). The tracker text is what the HUD shows.

import { MISSIONS } from './config.js';

export function createMissionState() {
  return {
    index: 0,          // which mission is current
    stage: 0,          // which stage inside it
    timer: 0,          // seconds left on a timed stage (0 = untimed)
    done: [false, false, false, false],
    failed: false,
    message: '',
    messageT: 0,
    collected: 0,
    remainingSpots: [],
    startedAt: 0,
  };
}

export function currentMission(m) {
  return m.index < MISSIONS.length ? MISSIONS[m.index] : null;
}

export function currentStage(m) {
  const mission = currentMission(m);
  return mission ? mission.stages[m.stage] : null;
}

export function objectiveText(m) {
  const mission = currentMission(m);
  if (!mission) return 'All jobs done — Solmar is yours. Free roam!';
  const stage = mission.stages[m.stage];
  let text = `${mission.name}: ${stage.label}`;
  if (m.timer > 0) text += `  [${Math.ceil(m.timer)}s]`;
  if (stage.type === 'collect') text += `  (${m.collected}/${stage.count})`;
  return text;
}

export function setMessage(game, text, seconds = 4) {
  game.missions.message = text;
  game.missions.messageT = seconds;
}

function beginStage(game, stage) {
  const m = game.missions;
  m.timer = stage.timer || 0;
  if (stage.type === 'collect') {
    m.collected = 0;
    m.remainingSpots = stage.spots.map((s) => ({ ...s }));
  }
}

export function startMission(game, index) {
  const m = game.missions;
  m.index = index;
  m.stage = 0;
  m.failed = false;
  const mission = MISSIONS[index];
  beginStage(game, mission.stages[0]);
  setMessage(game, `${mission.name} — ${mission.intro}`, 5);
  game.audio.blip();
}

function advanceStage(game) {
  const m = game.missions;
  const mission = currentMission(m);
  m.stage += 1;
  if (m.stage >= mission.stages.length) {
    // Mission complete: pay out and roll to the next job.
    m.done[m.index] = true;
    game.player.cash += mission.reward;
    setMessage(game, `${mission.name} complete! +$${mission.reward}`, 5);
    game.audio.missionDone();
    game.save();
    m.index += 1;
    m.stage = 0;
    if (m.index < MISSIONS.length) beginStage(game, MISSIONS[m.index].stages[0]);
    return;
  }
  beginStage(game, mission.stages[m.stage]);
  game.audio.blip();
}

function failMission(game, why) {
  const m = game.missions;
  m.failed = true;
  setMessage(game, `MISSION FAILED — ${why}. Press M to retry.`, 6);
  game.audio.denied();
}

export function retryMission(game) {
  const m = game.missions;
  if (!m.failed) return;
  m.failed = false;
  m.stage = 0;
  beginStage(game, currentMission(m).stages[0]);
  setMessage(game, `${currentMission(m).name} — try again.`, 4);
}

// Jump straight to a mission/stage (save restore, screenshot scenes).
export function jumpToStage(game, index, stage) {
  const m = game.missions;
  m.index = index;
  m.stage = stage;
  m.failed = false;
  beginStage(game, MISSIONS[index].stages[stage]);
}

// The marker the HUD minimap and the world arrow point at, if any.
export function missionMarker(game) {
  const m = game.missions;
  if (m.failed) return null;
  const stage = currentStage(m);
  if (!stage) return null;
  if (stage.type === 'goto') return { x: stage.x, y: stage.y };
  if (stage.type === 'collect' && m.remainingSpots.length) return m.remainingSpots[0];
  return null;
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (m.messageT > 0) m.messageT -= dt;
  const mission = currentMission(m);
  if (!mission || m.failed) return;
  const stage = mission.stages[m.stage];
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(game, 'out of time'); return; }
  }

  if (stage.type === 'enter-car') {
    if (p.inCar) advanceStage(game);
  } else if (stage.type === 'goto') {
    if (Math.hypot(px - stage.x, py - stage.y) < stage.radius) advanceStage(game);
  } else if (stage.type === 'wanted') {
    if (game.wanted >= stage.min) advanceStage(game);
  } else if (stage.type === 'escape') {
    if (game.wanted === 0) advanceStage(game);
  } else if (stage.type === 'collect') {
    for (let i = m.remainingSpots.length - 1; i >= 0; i--) {
      const s = m.remainingSpots[i];
      if (Math.hypot(px - s.x, py - s.y) < 60) {
        m.remainingSpots.splice(i, 1);
        m.collected += 1;
        game.addWanted(1, 'Turf pickup spotted');
        game.audio.blip();
        game.addParticle(s.x, s.y, '#f2c230', 14);
        if (m.collected >= stage.count) advanceStage(game);
        break;
      }
    }
  }
}
