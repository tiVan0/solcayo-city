// Solcayo — traffic AI: NPC cars follow road lanes, stop at red lights,
// turn at intersections, honk and slow down for the car ahead.
import { ROAD_STEP, ROAD_HALF, VEHICLES } from './config.js';
import { spawnVehicle, driveVehicle } from './vehicles.js';
import { lightPhase } from './city.js';

const NPC_DEFS = ['kancil', 'veloce', 'banteng', 'angkasa', 'kancil', 'veloce'];
const NPC_COLORS = ['#4b8fd9', '#e8e4da', '#7a5fd0', '#d95f4b', '#3f7d44', '#e8b23a', '#c0392b'];

export function spawnTraffic(G, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const defId = NPC_DEFS[i % NPC_DEFS.length];
    const vertical = G.rng.chance(0.5);
    const line = (1 + G.rng.int(0, 6)) * ROAD_STEP;
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const along = G.rng.range(200, 3000);
    // Right-hand lane: offset +18 in the travel direction's right side.
    const off = 18;
    const x = vertical ? line + (dir > 0 ? off : -off) : along;
    const y = vertical ? along : line + (dir > 0 ? -off : off);
    const angle = vertical ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = spawnVehicle(G.city, defId, x, y, angle, { driver: 'npc', color: NPC_COLORS[i % NPC_COLORS.length] });
    car.lane = { vertical, line, dir };
    car.cruise = G.rng.range(2.2, 3.6);
    car.wait = 0;
    list.push(car);
  }
  return list;
}

// Is there a red light ahead for this car? Checks the nearest lit intersection
// in front of it (within 90 px of the stop line).
function redLightAhead(G, car) {
  const { vertical, line, dir } = car.lane;
  const along = vertical ? car.y : car.x;
  for (const light of G.city.lights) {
    const lightAlong = vertical ? light.y : light.x;
    const lightLine = vertical ? light.x : light.y;
    if (Math.abs(lightLine - line) > 4) continue;
    const dist = (lightAlong - along) * dir;
    if (dist > 8 && dist < 100) {
      const phase = lightPhase(G.tick + light.offset);
      const greenForMe = vertical ? (phase === 'ns') : (phase === 'ew');
      if (!greenForMe) return true;
    }
  }
  return false;
}

function carAhead(G, car) {
  const ax = Math.sin(car.angle), ay = -Math.cos(car.angle);
  let best = 999;
  for (const other of G.vehicles) {
    if (other === car || other.hp <= 0) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const forward = dx * ax + dy * ay;
    const side = Math.abs(dx * ay - dy * ax);
    if (forward > 0 && forward < 70 && side < 30) best = Math.min(best, forward);
  }
  return best;
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    if (car.hp <= 0) continue;
    const { vertical, line, dir } = car.lane;
    const along = vertical ? car.y : car.x;
    // At an intersection, sometimes turn onto the crossing road.
    const nearLine = Math.abs(((along % ROAD_STEP) + ROAD_STEP) % ROAD_STEP) < 6;
    if (nearLine && G.rng.chance(0.004)) {
      const cross = Math.round(along / ROAD_STEP) * ROAD_STEP;
      const newDir = G.rng.chance(0.5) ? 1 : -1;
      car.lane = { vertical: !vertical, line: cross, dir: newDir };
      car.angle = !vertical ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? Math.PI : 0);
      if (!vertical) car.y = cross + (newDir > 0 ? -18 : 18);
      else car.x = cross + (newDir > 0 ? 18 : -18);
    }
    // Speed control: red light or car ahead means slow down / stop.
    let target = car.cruise;
    if (redLightAhead(G, car)) target = 0;
    const ahead = carAhead(G, car);
    if (ahead < 70) target = Math.min(target, ahead < 34 ? 0 : 1.2);
    // Steer gently back onto the lane centre, then drive.
    const want = vertical ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-0.03, Math.min(0.03, diff)) * dt;
    const throttle = target > 0 ? 1 : -1;
    if (target === 0 && Math.abs(car.speed) < 0.2) car.speed = 0;
    else driveVehicle(G.city, car, 0, throttle, false, dt);
    // Cap NPC speed at cruise.
    if (car.speed > target) car.speed = Math.max(target, car.speed - 0.15 * dt);
    if (car.speed < 0) car.speed = 0;
    // Keep the car glued to its lane.
    if (vertical) car.x = line + (dir > 0 ? 18 : -18);
    else car.y = line + (dir > 0 ? -18 : 18);
    if (G.rng.chance(0.0006)) { car.honk = 30; G.audio.horn(); }
    if (car.honk > 0) car.honk -= dt;
  }
}

export { VEHICLES };
