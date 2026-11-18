// Solmar Heat — radio.js
// In-car radio: three synthesized stations, switched with R. The audio
// itself is a step sequencer in AudioSys (no audio files); this file is the
// state the HUD and the sim read: which station, whether it is on, and the
// station list from config. Radio plays only while Rico is in a car.

import { RADIO_STATIONS } from './config.js';

export function createRadio() {
  return {
    station: 0,          // index into RADIO_STATIONS
    on: false,           // true while driving with the radio playing
    switchedT: 0,        // cooldown so one R press is one switch
  };
}

export function currentStation(radio) {
  return radio.on ? RADIO_STATIONS[radio.station] : null;
}

export function radioOn(game) {
  game.radio.on = true;
  game.audio.setRadioStationData(RADIO_STATIONS[game.radio.station]);
  game.audio.setRadio(game.radio.station);
}

export function radioOff(game) {
  game.radio.on = false;
  game.audio.setRadio(-1);
}

// R cycles: station 0 -> 1 -> 2 -> off -> 0 ...
export function cycleStation(game) {
  const r = game.radio;
  if (r.switchedT > 0) return;
  r.switchedT = 0.25;
  if (!r.on) {
    r.on = true;
    r.station = 0;
  } else if (r.station < RADIO_STATIONS.length - 1) {
    r.station += 1;
  } else {
    r.on = false;
  }
  if (r.on) game.audio.setRadioStationData(RADIO_STATIONS[r.station]);
  game.audio.setRadio(r.on ? r.station : -1);
  if (r.on) game.audio.blip();
}

export function updateRadio(game, dt) {
  const r = game.radio;
  r.switchedT = Math.max(0, r.switchedT - dt);
  // Radio dies when Rico leaves the car; it comes back on the station he
  // left it on when he gets back in.
  if (!game.player.inCar && r.on) radioOff(game);
}
