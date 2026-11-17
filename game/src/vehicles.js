// Solcayo — vehicle physics (arcade + drift + damage) and the boat on the canal.
import { VEHICLES, WORLD } from './config.js';
import { onBridge } from './city.js';

let nextVehicleId = 1;

export function spawnVehicle(city, defId, x, y, angle, opts = {}) {
  const def = VEHICLES[defId];
  const v = {
    id: nextVehicleId++, defId, def, x, y, angle,
    speed: 0, hp: def.hp, maxHp: def.hp,
    driver: opts.driver || 'none', // 'player' | 'npc' | 'police' | 'target' | 'none'
    color: opts.color || def.color,
    parked: opts.parked || false,
    locked: opts.locked || false,
    smoke: 0, skid: 0, honk: 0, spike: 0, // spike: ticks of flat-tyre slowdown
    steer: 0, throttle: 0,
  };
  return v;
}

// Arcade car physics: throttle accelerates, steering scales with speed,
// handbrake cuts grip for a drift slide. Returns distance travelled.
export function driveVehicle(city, v, steerInput, throttleInput, handbrake, dtScale = 1) {
  const def = v.def;
  const top = v.spike > 0 ? 1.6 : def.top;
  if (throttleInput > 0) v.speed += def.accel * throttleInput * dtScale;
  else if (throttleInput < 0) v.speed += def.accel * 1.6 * throttleInput * dtScale; // brake/reverse
  else v.speed *= (1 - 0.02 * dtScale); // rolling drag
  if (handbrake) v.speed *= (1 - 0.05 * dtScale);
  v.speed = Math.max(-top * 0.45, Math.min(top, v.speed));
  if (Math.abs(v.speed) < 0.05 && throttleInput === 0) v.speed = 0;

  const grip = handbrake ? 0.45 : 1;
  const turnRate = def.turn * Math.sign(v.speed) * Math.min(1, Math.abs(v.speed) / 2.5) * grip;
  v.angle += steerInput * turnRate * dtScale;
  if (handbrake && Math.abs(v.speed) > 3) v.skid = Math.max(v.skid, 12);

  const nx = v.x + Math.sin(v.angle) * v.speed * dtScale;
  const ny = v.y - Math.cos(v.angle) * v.speed * dtScale;
  const hit = city.collide(nx, ny, def.w / 2 + 2, v.def.kind === 'boat');
  // Boats stay in the canal: beaching onto dry land is not allowed.
  if (v.def.kind === 'boat' && !city.isWater(hit.x, hit.y) && !onBridge(hit.x, hit.y)) {
    v.speed *= 0.3;
    return 0;
  }
  const collided = Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5;
  if (collided && Math.abs(v.speed) > 2.5) {
    damageVehicle(v, Math.abs(v.speed) * 4);
    v.speed *= 0.4;
  }
  v.x = hit.x; v.y = hit.y;
  if (v.skid > 0) v.skid -= dtScale;
  if (v.spike > 0) v.spike -= dtScale;
  if (v.smoke > 0) v.smoke -= dtScale;
  return Math.abs(v.speed) * dtScale;
}

export function damageVehicle(v, amount) {
  v.hp -= amount;
  if (v.hp < v.maxHp * 0.4) v.smoke = Math.max(v.smoke, 30);
  if (v.hp <= 0) { v.hp = 0; v.speed = 0; v.smoke = 9999; }
  return v.hp <= 0;
}

export function repairVehicle(v) {
  v.hp = v.maxHp; v.smoke = 0; v.spike = 0;
}

// Simple circle overlap between two vehicles (used for bumps + police rams).
export function vehiclesOverlap(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const r = (a.def.l + b.def.l) / 4;
  return dx * dx + dy * dy < r * r;
}

// Parked-car starter set for the city, placed on the fixed parking spots.
export function spawnParkedCars(city, rng) {
  const defs = ['kancil', 'veloce', 'banteng', 'angkasa', 'kancil', 'veloce', 'banteng', 'kancil', 'angkasa', 'veloce'];
  return city.parkingSpots.map((s, i) =>
    spawnVehicle(city, defs[i % defs.length], s.x, s.y, s.angle, { driver: 'none', parked: true, locked: rng.chance(0.25) }));
}

export { WORLD };
