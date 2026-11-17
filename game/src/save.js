// Solcayo — save / load in localStorage: money, missions, owned cars,
// reputation, postcards, position and heat. Autosaves after each mission.
import { TUNING } from './config.js';

function readSave() {
  try {
    const raw = window.localStorage.getItem(TUNING.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

export function saveGame(G) {
  const p = G.player;
  const data = {
    v: 1,
    money: p.money, rep: p.rep,
    missionsDone: p.missionsDone, missionIndex: G.missionIndex,
    owned: G.owned, postcardsFound: G.postcardsFound,
    postcardsTaken: G.city.postcards.map((c) => c.taken),
    x: p.x, y: p.y, heat: G.heat,
    distanceDriven: Math.round(p.distanceDriven), carsStolen: p.carsStolen,
    playTicks: p.playTicks,
  };
  try {
    window.localStorage.setItem(TUNING.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave(G) {
  const data = readSave();
  if (!data) return false;
  const p = G.player;
  p.money = data.money ?? 150;
  p.rep = data.rep ?? 0;
  p.missionsDone = data.missionsDone ?? 0;
  p.x = data.x ?? p.x; p.y = data.y ?? p.y;
  G.missionIndex = data.missionIndex ?? 0;
  G.owned = data.owned ?? ['kancil'];
  G.postcardsFound = data.postcardsFound ?? 0;
  G.city.postcards.forEach((c, i) => { c.taken = !!data.postcardsTaken?.[i]; });
  p.distanceDriven = data.distanceDriven ?? 0;
  p.carsStolen = data.carsStolen ?? 0;
  p.playTicks = data.playTicks ?? 0;
  if (data.heat) {
    // Loading with heat would be cruel: the save keeps the story, not the chase.
    G.heat = 0;
  }
  return true;
}

export function clearSave() {
  try { window.localStorage.removeItem(TUNING.saveKey); } catch { /* ignore */ }
}
