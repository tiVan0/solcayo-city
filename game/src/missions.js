// Solcayo — the mission engine: 6 chained story missions from Dario Venn,
// each a list of stages (goto / drive / boat / punch / tail / escape).
// Failing a timed stage retries that mission from its first stage.
import { MISSIONS, SPOTS, TUNING } from './config.js';
import { spawnVehicle } from './vehicles.js';
import { setHeat } from './wanted.js';

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id);
}

export function startMission(G, id) {
  const def = missionById(id);
  if (!def) return false;
  G.mission = {
    active: true, id: def.id, def, stageIndex: 0,
    timer: 0, tailProgress: 0, tailWarn: 0,
    banner: '', bannerT: 0, failed: false,
  };
  G.dialog = { lines: def.dialog, t: 0, shown: 0 };
  setupStage(G);
  G.events.push({ type: 'missionStart', id: def.id, name: def.name });
  return true;
}

export function currentStage(G) {
  if (!G.mission || !G.mission.active) return null;
  return G.mission.def.stages[G.mission.stageIndex];
}

export function missionLabel(G) {
  const s = currentStage(G);
  if (!s) return G.mission ? `${G.mission.def.name} — selesai` : 'Bebas — cari Dario';
  return `${G.mission.def.name} — ${s.label}`;
}

function setupStage(G) {
  const s = currentStage(G);
  if (!s) return;
  const m = G.mission;
  m.timer = s.seconds ? s.seconds * 60 : 0;
  m.tailProgress = 0; m.tailWarn = 0;
  if (s.kind === 'punchDriver') {
    // The Kessler van waits at the port gate with its driver inside.
    const van = spawnVehicle(G.city, 'angkasa', SPOTS.portGate.x + 100, SPOTS.portGate.y, Math.PI / 2,
      { driver: 'target', color: '#2b2b2b' });
    van.driverHp = 3;
    G.missionVan = van; G.vehicles.push(van);
  }
  if (s.kind === 'tail') {
    // A black Kessler sedan drives a loop around Downtown; tail it.
    const car = spawnVehicle(G.city, 'veloce', 2400, 2400, Math.PI,
      { driver: 'target', color: '#1c1c22' });
    car.route = [
      { x: 2400, y: 800 }, { x: 800, y: 800 },
      { x: 800, y: 2400 }, { x: 2400, y: 2400 },
    ];
    car.routeIndex = 0;
    G.tailTarget = car; G.vehicles.push(car);
  }
  if (s.heat) setHeat(G, s.heat);
  if (s.kind === 'timed') m.timer = s.seconds * 60;
}

function advanceStage(G) {
  const m = G.mission;
  m.stageIndex += 1;
  G.audio.jingle();
  if (m.stageIndex >= m.def.stages.length) {
    completeMission(G);
    return;
  }
  setupStage(G);
}

function completeMission(G) {
  const m = G.mission;
  const def = m.def;
  G.player.money += def.reward;
  G.player.rep = Math.min(5, G.player.rep + def.rep);
  G.player.missionsDone += 1;
  G.mission = { active: false, id: def.id, def, stageIndex: 0, justCompleted: def, bannerT: 240 };
  G.events.push({ type: 'missionComplete', id: def.id, name: def.name, reward: def.reward });
  G.audio.jingle();
  G.autosave();
  // The next mission in the chain opens after a short breather.
  G.missionIndex = def.id + 1;
  G.nextMissionAt = G.tick + 240;
  if (G.missionVan) { G.missionVan = null; }
  if (G.tailTarget) { G.tailTarget = null; }
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m || !m.active) return;
  m.failed = true;
  m.banner = `MISI GAGAL — ${reason}. Coba lagi!`;
  m.bannerT = 240;
  G.events.push({ type: 'missionFail', id: m.id, reason });
  setHeat(G, 0);
  // Retry from the first stage of the same mission.
  m.stageIndex = 0; m.failed = false;
  setupStage(G);
}

function playerPos(G) {
  const p = G.player;
  return p.vehicle ? { x: p.vehicle.x, y: p.vehicle.y } : { x: p.x, y: p.y };
}

function within(G, x, y, r) {
  const pos = playerPos(G);
  return Math.hypot(pos.x - x, pos.y - y) < r;
}

export function updateMission(G, dt) {
  // Chain: open the next mission after the breather.
  if (!G.mission?.active && G.nextMissionAt && G.tick >= G.nextMissionAt && G.missionIndex <= 6) {
    G.nextMissionAt = 0;
    startMission(G, G.missionIndex);
  }
  if (G.mission?.bannerT > 0) G.mission.bannerT -= dt;
  const m = G.mission;
  if (!m || !m.active) return;
  const s = currentStage(G);
  if (!s) return;
  const p = G.player;

  switch (s.kind) {
    case 'goto':
      if (within(G, s.x, s.y, s.r)) advanceStage(G);
      break;
    case 'enterCar':
      if (p.vehicle && p.vehicle.def.kind === 'car') advanceStage(G);
      break;
    case 'driveTo':
      if (p.vehicle && within(G, s.x, s.y, s.r)) advanceStage(G);
      break;
    case 'timed': {
      m.timer -= dt;
      if (p.vehicle && within(G, s.x, s.y, s.r)) advanceStage(G);
      else if (m.timer <= 0) failMission(G, 'waktu habis');
      break;
    }
    case 'enterBoat':
      if (p.vehicle && p.vehicle.def.kind === 'boat') advanceStage(G);
      break;
    case 'boatTo':
      if (p.vehicle && p.vehicle.def.kind === 'boat' && within(G, s.x, s.y, s.r)) advanceStage(G);
      break;
    case 'punchDriver':
      if (G.missionVan && G.missionVan.driver === 'none') advanceStage(G);
      break;
    case 'enterVan':
      if (p.vehicle === G.missionVan) advanceStage(G);
      break;
    case 'escape':
    case 'checkpoint':
      if (within(G, s.x, s.y, s.r)) advanceStage(G);
      break;
    case 'tail': {
      const t = G.tailTarget;
      if (!t) { advanceStage(G); break; }
      const pos = playerPos(G);
      const d = Math.hypot(pos.x - t.x, pos.y - t.y);
      if (d >= 70 && d <= 260) { m.tailProgress += dt; m.tailWarn = 0; }
      else {
        m.tailWarn += dt;
        if (m.tailWarn > 180) { failMission(G, 'ketahuan / kehilangan jejak'); return; }
      }
      if (m.tailProgress >= s.seconds * 60) advanceStage(G);
      break;
    }
    case 'photo':
      if (within(G, s.x, s.y, s.r)) {
        G.events.push({ type: 'photo', x: s.x, y: s.y });
        advanceStage(G);
      }
      break;
    default:
      break;
  }
}

// The tail target drives its loop on the roads, oblivious to Mara.
export function updateTailTarget(G, dt) {
  const t = G.tailTarget;
  if (!t || t.driver !== 'target') return;
  const wp = t.route[t.routeIndex];
  if (!wp) return;
  const dx = wp.x - t.x, dy = wp.y - t.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) { t.routeIndex = (t.routeIndex + 1) % t.route.length; return; }
  const want = Math.atan2(dx, -dy);
  let diff = want - t.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2));
  t.speed = 2.6;
  t.x += Math.sin(t.angle) * t.speed * dt;
  t.y -= Math.cos(t.angle) * t.speed * dt;
  t.angle += steer * 0.03 * dt;
}

export { TUNING };
