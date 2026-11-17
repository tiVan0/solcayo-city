// Solcayo — Mara on foot: walking, running, entering/exiting cars, punching,
// health, BUSTED / WASTED. Driving itself lives in vehicles.js.
import { TUNING, VEHICLES } from './config.js';
import { driveVehicle } from './vehicles.js';

export function createPlayer(city, spawn) {
  return {
    x: spawn.x, y: spawn.y, angle: 0,
    onFoot: true, vehicle: null,
    health: TUNING.playerHealth, maxHealth: TUNING.playerHealth,
    money: 150, rep: 0,
    punchCooldown: 0, punchAnim: 0,
    bustedTimer: 0, // seconds a police car has been touching the player
    distanceDriven: 0, carsStolen: 0, missionsDone: 0, playTicks: 0,
    nearVehicle: null, nearBoat: null,
  };
}

// Nearest drivable vehicle within reach (cars on land, boat in water).
export function nearestVehicle(G, maxDist = 70) {
  const p = G.player;
  let best = null, bestD = maxDist;
  for (const v of G.vehicles) {
    if (v.driver === 'police' || v.driver === 'target') continue;
    if (v.def.kind === 'boat') continue;
    if (v.hp <= 0) continue;
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function nearestBoat(G, maxDist = 80) {
  const p = G.player;
  for (const v of G.vehicles) {
    if (v.def.kind !== 'boat') continue;
    if (Math.hypot(v.x - p.x, v.y - p.y) < maxDist) return v;
  }
  return null;
}

export function enterVehicle(G, v) {
  const p = G.player;
  p.vehicle = v; p.onFoot = false;
  v.driver = 'player'; v.parked = false;
  if (v.locked) v.locked = false; // lockpick succeeds instantly once reached (v1 scope)
  p.carsStolen += 1;
  G.audio.beep(660, 0.08);
  return v;
}

export function exitVehicle(G) {
  const p = G.player;
  const v = p.vehicle;
  if (!v) return;
  // Step out to the side of the car, onto dry land.
  const side = v.angle + Math.PI / 2;
  const px = v.x + Math.sin(side) * 30, py = v.y - Math.cos(side) * 30;
  const fixed = G.city.collide(px, py, 12, false);
  p.x = fixed.x; p.y = fixed.y; p.angle = v.angle;
  p.vehicle = null; p.onFoot = true;
  v.driver = 'none'; v.speed = 0;
}

export function updatePlayer(G, input, dt) {
  const p = G.player;
  const city = G.city;
  p.playTicks += dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;

  // Slow health regen when nobody is chasing.
  if (G.heat === 0 && p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + TUNING.healthRegen * dt);

  if (!p.onFoot && p.vehicle) {
    // Driving: steering + throttle from input, distance for stats.
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    const moved = drivePlayerCar(G, steer, throttle, input.handbrake, dt);
    p.distanceDriven += moved;
    if (input.interactPressed) exitVehicle(G);
    if (input.punchPressed && p.vehicle.def.kind === 'car') G.audio.horn();
    return;
  }

  // On foot.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    const speed = input.run ? TUNING.runSpeed : TUNING.walkSpeed;
    const nx = p.x + mx * speed * dt, ny = p.y + my * speed * dt;
    const fixed = city.collide(nx, ny, 12, false);
    p.x = fixed.x; p.y = fixed.y;
    p.angle = Math.atan2(mx, -my);
  }

  p.nearVehicle = nearestVehicle(G);
  p.nearBoat = nearestBoat(G);
  if (input.interactPressed) {
    if (p.nearVehicle) { enterVehicle(G, p.nearVehicle); G.audio.beep(520, 0.06); }
    else if (p.nearBoat) { enterVehicle(G, p.nearBoat); G.audio.beep(520, 0.06); }
  }
  if (input.punchPressed && p.punchCooldown <= 0) {
    p.punchCooldown = TUNING.punchCooldown; p.punchAnim = 14;
    G.audio.punch();
    punchNearby(G);
  }
}

// The punch hits the closest punchable thing in front of Mara.
export function punchNearby(G) {
  const p = G.player;
  const px = p.x + Math.sin(p.angle) * 26, py = p.y - Math.cos(p.angle) * 26;
  // Pedestrians get shoved and run away.
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - px, ped.y - py) < TUNING.punchRange) {
      ped.flee = 240; ped.angry = 120;
      G.events.push({ type: 'punchPed', x: ped.x, y: ped.y });
      return 'ped';
    }
  }
  // Mission 4: the Kessler van driver.
  if (G.missionVan && G.missionVan.driver === 'target') {
    const v = G.missionVan;
    if (Math.hypot(v.x - px, v.y - py) < TUNING.punchRange + 20) {
      v.driverHp = (v.driverHp ?? 3) - 1;
      G.events.push({ type: 'punchDriver', x: v.x, y: v.y, left: v.driverHp });
      if (v.driverHp <= 0) { v.driver = 'none'; G.events.push({ type: 'driverFled', x: v.x, y: v.y }); }
      return 'driver';
    }
  }
  return null;
}

function drivePlayerCar(G, steer, throttle, handbrake, dt) {
  const v = G.player.vehicle;
  return driveVehicle(G.city, v, steer, throttle, handbrake, dt);
}

export { VEHICLES };
