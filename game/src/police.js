// Solcayo — police AI: patrol at Heat 0, chase at Heat 1+, roadblocks and
// spike strips at Heat 3+, a full search at Heat 5. Touching the player
// for 3 seconds while slow = BUSTED.
import { TUNING, SPOTS } from './config.js';
import { spawnVehicle, driveVehicle, vehiclesOverlap } from './vehicles.js';

export function wantedPoliceCount(heat) {
  if (heat <= 0) return 1; // one patrol car cruising the city
  return Math.min(TUNING.maxPolice, 1 + heat);
}

export function spawnPoliceCar(G, x, y) {
  const car = spawnVehicle(G.city, 'interceptor', x, y, 0, { driver: 'police' });
  car.sirenPhase = G.rng.range(0, 40);
  car.bustedHold = 0;
  return car;
}

function steerToward(car, tx, ty, dt) {
  const want = Math.atan2(tx - car.x, -(ty - car.y));
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  return steer;
}

export function startPoliceChase(G) {
  // Spawn fresh pursuit cars near (but not on top of) the player.
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const want = wantedPoliceCount(G.heat);
  while (G.police.length < want) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = TUNING.policeSpawnDistance;
    const x = px + Math.sin(a) * d, y = py + Math.cos(a) * d;
    const fixed = G.city.collide(x, y, 20, false);
    G.police.push(spawnPoliceCar(G, fixed.x, fixed.y));
    G.vehicles.push(G.police[G.police.length - 1]);
  }
  G.audio.siren(true);
}

export function stopPoliceChase(G) {
  // Heat is gone: pursuit cars drive off and despawn at distance.
  G.audio.siren(false);
}

export function placeRoadblock(G) {
  // Two police cars parked across the road ahead of the player's heading.
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const heading = p.vehicle ? p.vehicle.angle : p.angle;
  const ahead = 420;
  const cx = px + Math.sin(heading) * ahead, cy = py - Math.cos(heading) * ahead;
  const perp = heading + Math.PI / 2;
  for (const side of [-1, 1]) {
    const bx = cx + Math.sin(perp) * side * 26, by = cy - Math.cos(perp) * side * 26;
    const car = spawnPoliceCar(G, bx, by);
    car.angle = perp; car.parked = true; car.blocking = true;
    G.police.push(car); G.vehicles.push(car);
  }
  // Spike strip across the road just before the block.
  const sx = cx - Math.sin(heading) * 90, sy = cy + Math.cos(heading) * 90;
  G.spikes.push({ x: sx, y: sy, angle: perp, ttl: 900 });
  G.events.push({ type: 'roadblock', x: cx, y: cy });
}

export function updatePolice(G, dt) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  const playerSpeed = p.vehicle ? Math.abs(p.vehicle.speed) : 0;

  // Keep the right number of cars on the street.
  const want = wantedPoliceCount(G.heat);
  if (G.heat >= 1 && G.police.length < want) startPoliceChase(G);
  if (G.heat >= 3 && !G.roadblockPlaced && G.tick % 600 === 0) {
    placeRoadblock(G); G.roadblockPlaced = true;
  }
  if (G.heat === 0) G.roadblockPlaced = false;

  for (const cop of [...G.police]) {
    cop.sirenPhase = (cop.sirenPhase + dt) % 80;
    if (cop.blocking) continue; // roadblock cars stay parked across the road
    let targetX, targetY, speed;
    if (G.heat === 0) {
      // Patrol: cruise slowly toward a wandering waypoint ON a road
      // (an intersection), so the patrol car does not cut across blocks.
      if (!cop.patrol || Math.hypot(cop.patrol.x - cop.x, cop.patrol.y - cop.y) < 60 || G.rng.chance(0.001)) {
        cop.patrol = { x: (1 + G.rng.int(0, 6)) * 400, y: (1 + G.rng.int(0, 6)) * 400 };
      }
      targetX = cop.patrol.x; targetY = cop.patrol.y; speed = 2.2;
    } else {
      // Chase: aim at the player's nose, ram to slow them down.
      const lead = playerSpeed * 6;
      const heading = p.vehicle ? p.vehicle.angle : p.angle;
      targetX = px + Math.sin(heading) * lead;
      targetY = py - Math.cos(heading) * lead;
      speed = TUNING.policeChaseSpeed;
    }
    const steer = steerToward(cop, targetX, targetY, dt);
    const dist = Math.hypot(targetX - cop.x, targetY - cop.y);
    driveVehicle(G.city, cop, steer, dist > 40 ? 1 : 0.2, false, dt);
    if (cop.speed > speed) cop.speed = speed;

    // Bumping the player's car damages it and slows it.
    if (p.vehicle && vehiclesOverlap(cop, p.vehicle)) {
      p.vehicle.speed *= 0.92;
      if (G.tick % 30 === 0) G.events.push({ type: 'rammed', x: px, y: py });
    }
    // BUSTED: a police car touching a slow player for 3 seconds.
    const touch = Math.hypot(cop.x - px, cop.y - py) < 44;
    if (touch && playerSpeed < 1.2 && G.heat >= 1) {
      cop.bustedHold = (cop.bustedHold || 0) + dt;
      if (cop.bustedHold > 180) {
        G.events.push({ type: 'busted', x: px, y: py });
        cop.bustedHold = 0;
      }
    } else {
      cop.bustedHold = 0;
    }
    // Despawn pursuit cars that fell far behind once heat is gone.
    if (G.heat === 0 && Math.hypot(cop.x - px, cop.y - py) > 1400) {
      G.police.splice(G.police.indexOf(cop), 1);
      G.vehicles.splice(G.vehicles.indexOf(cop), 1);
    }
  }

  // Spike strips: crossing one at speed flattens the tyres.
  for (const spike of [...G.spikes]) {
    spike.ttl -= dt;
    if (spike.ttl <= 0) { G.spikes.splice(G.spikes.indexOf(spike), 1); continue; }
    if (p.vehicle && Math.hypot(p.vehicle.x - spike.x, p.vehicle.y - spike.y) < 40 && Math.abs(p.vehicle.speed) > 1) {
      p.vehicle.spike = 600;
      p.vehicle.speed *= 0.3;
      G.events.push({ type: 'spike', x: spike.x, y: spike.y });
      G.spikes.splice(G.spikes.indexOf(spike), 1);
    }
  }
}

export { SPOTS };
