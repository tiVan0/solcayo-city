// Solcayo — the Heat system (wanted level 0-5): crimes raise it, hiding
// lowers it, the garage sells a "damai" (bribe) and the safehouse clears it.
import { TUNING } from './config.js';

export function raiseHeat(G, amount, reason) {
  const before = G.heat;
  G.heat = Math.max(0, Math.min(5, G.heat + amount));
  G.hiddenTimer = 0;
  if (G.heat !== before) {
    G.events.push({ type: 'heat', from: before, to: G.heat, reason });
    if (G.heat >= 1) G.audio.siren(true);
  }
  return G.heat;
}

export function setHeat(G, level) {
  const before = G.heat;
  G.heat = Math.max(0, Math.min(5, level));
  G.hiddenTimer = 0;
  if (G.heat !== before) G.events.push({ type: 'heat', from: before, to: G.heat, reason: 'mission' });
  if (G.heat >= 1) G.audio.siren(true);
  else G.audio.siren(false);
}

// Is any police car close enough to see the player right now?
export function policeCanSee(G) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  for (const cop of G.police) {
    if (Math.hypot(cop.x - px, cop.y - py) < 450) return true;
  }
  return false;
}

export function updateHeat(G, dt) {
  if (G.heat === 0) return;
  if (policeCanSee(G)) {
    G.hiddenTimer = 0;
    return;
  }
  // Out of sight: the heat clock ticks down, one star at a time.
  G.hiddenTimer += dt;
  if (G.hiddenTimer >= TUNING.heatDecayHiddenSeconds * 60) {
    G.hiddenTimer = 0;
    raiseHeat(G, -1, 'hidden');
    if (G.heat === 0) G.audio.siren(false);
  }
}

// Bribe at the garage: $200 per heat star. Returns true when paid.
export function payBribe(G) {
  const cost = G.heat * TUNING.bribePerHeat;
  if (G.heat === 0 || G.player.money < cost) return false;
  G.player.money -= cost;
  setHeat(G, 0);
  G.events.push({ type: 'bribe', cost });
  return true;
}

export function clearHeatAtSafehouse(G) {
  if (G.heat === 0) return false;
  setHeat(G, 0);
  return true;
}
