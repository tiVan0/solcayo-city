// Solcayo — economy: money, reputation, the garage (repair / bribe / buy),
// the taxi side job, the time trial, and the 12 Solcayo postcards.
import { TUNING, VEHICLES, SPOTS } from './config.js';
import { spawnVehicle, repairVehicle } from './vehicles.js';
import { payBribe } from './wanted.js';

export function repairCost(v) {
  const missing = v.maxHp - v.hp;
  return Math.min(400, 100 + Math.round(missing * 2));
}

export function nearGarage(G) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  return Math.hypot(px - SPOTS.garage.x, py - SPOTS.garage.y) < 130;
}

export function nearSafehouse(G) {
  const p = G.player;
  return Math.hypot(p.x - SPOTS.safehouse.x, p.y - SPOTS.safehouse.y) < 110 && p.onFoot;
}

// Garage menu actions, triggered by number keys while near the garage.
export function garageAction(G, key) {
  const p = G.player;
  if (key === '1' && p.vehicle) {
    const cost = repairCost(p.vehicle);
    if (p.money >= cost) {
      p.money -= cost; repairVehicle(p.vehicle);
      G.events.push({ type: 'repaired', cost });
      G.audio.beep(520, 0.1);
      return true;
    }
  }
  if (key === '2' && G.heat > 0) return payBribe(G);
  if (key === '3' && !G.owned.includes('veloce') && p.money >= VEHICLES.veloce.price) {
    p.money -= VEHICLES.veloce.price;
    G.owned.push('veloce');
    const car = spawnVehicle(G.city, 'veloce', SPOTS.garage.x + 60, SPOTS.garage.y + 40, 0, { driver: 'none', parked: true });
    G.vehicles.push(car);
    G.events.push({ type: 'bought', name: 'Veloce S', cost: VEHICLES.veloce.price });
    return true;
  }
  return false;
}

// ---- Taxi side job ----
export function startTaxi(G) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const a = G.rng.range(0, Math.PI * 2);
  const dest = {
    x: Math.max(200, Math.min(3000, px + Math.sin(a) * G.rng.range(600, 1400))),
    y: Math.max(200, Math.min(3000, py + Math.cos(a) * G.rng.range(600, 1400))),
  };
  G.taxi = {
    active: true, phase: 'pickup',
    px: px + Math.sin(a + 1) * 260, py: py + Math.cos(a + 1) * 260,
    dx: dest.x, dy: dest.y,
    fare: G.rng.int(TUNING.taxiFareMin, TUNING.taxiFareMax),
  };
  G.events.push({ type: 'taxiStart', fare: G.taxi.fare });
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t || !t.active) return;
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  if (t.phase === 'pickup' && p.vehicle && Math.hypot(px - t.px, py - t.py) < 70) {
    t.phase = 'dropoff';
    G.events.push({ type: 'taxiPickup' });
  } else if (t.phase === 'dropoff' && p.vehicle && Math.hypot(px - t.dx, py - t.dy) < 80) {
    p.money += t.fare;
    G.events.push({ type: 'taxiDone', fare: t.fare });
    G.audio.jingle();
    t.active = false;
  }
}

// ---- Time trial side job ----
export function startTimeTrial(G) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const points = [];
  for (let i = 0; i < 3; i++) {
    points.push({
      x: Math.max(200, Math.min(3000, px + (i % 2 === 0 ? 500 : -500) * (i + 1))),
      y: Math.max(200, Math.min(3000, py + (i % 2 === 0 ? -400 : 500) * (i + 1))),
    });
  }
  G.trial = { active: true, points, index: 0, timer: 60 * 60 };
  G.events.push({ type: 'trialStart' });
}

export function updateTimeTrial(G, dt) {
  const t = G.trial;
  if (!t || !t.active) return;
  t.timer -= dt;
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const wp = t.points[t.index];
  if (wp && Math.hypot(px - wp.x, py - wp.y) < 90) {
    t.index += 1;
    G.audio.beep(880, 0.08);
    if (t.index >= t.points.length) {
      p.money += TUNING.timeTrialReward;
      G.events.push({ type: 'trialDone', reward: TUNING.timeTrialReward });
      G.audio.jingle();
      t.active = false;
    }
  } else if (t.timer <= 0) {
    G.events.push({ type: 'trialFail' });
    t.active = false;
  }
}

// ---- Postcards ----
export function updatePostcards(G) {
  const p = G.player;
  for (const card of G.city.postcards) {
    if (card.taken) continue;
    if (Math.hypot(p.x - card.x, p.y - card.y) < 40) {
      card.taken = true;
      p.money += TUNING.postcardReward;
      G.postcardsFound += 1;
      G.events.push({ type: 'postcard', found: G.postcardsFound });
      G.audio.beep(990, 0.12);
      if (G.postcardsFound >= TUNING.postcardCount) {
        p.money += TUNING.postcardBonus;
        G.events.push({ type: 'postcardBonus', bonus: TUNING.postcardBonus });
      }
    }
  }
}

export { VEHICLES };
