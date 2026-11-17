// Solcayo — pedestrians: walk the sidewalks, cross at zebra crossings,
// flee from danger, and get angry (a "!" pops over their head) when shoved.
import { ROAD_STEP, WALK_HALF } from './config.js';

const SHIRT_COLORS = ['#e8e4da', '#4b8fd9', '#d95f4b', '#7a5fd0', '#e8b23a', '#3f7d44', '#c0392b', '#2fb3c9'];

export function spawnPedestrians(G, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const vertical = G.rng.chance(0.5);
    const line = (1 + G.rng.int(0, 6)) * ROAD_STEP;
    const side = G.rng.chance(0.5) ? 1 : -1;
    const along = G.rng.range(200, 3000);
    const off = WALK_HALF - 6;
    list.push({
      x: vertical ? line + side * off : along,
      y: vertical ? along : line + side * off,
      angle: G.rng.range(0, Math.PI * 2),
      speed: G.rng.range(0.5, 1.1),
      shirt: SHIRT_COLORS[i % SHIRT_COLORS.length],
      vertical, line, side, dir: G.rng.chance(0.5) ? 1 : -1,
      flee: 0, angry: 0, crossing: false, walkPhase: G.rng.range(0, 6),
    });
  }
  return list;
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  const playerCar = p.vehicle;
  for (const ped of G.peds) {
    if (ped.flee > 0) ped.flee -= dt;
    if (ped.angry > 0) ped.angry -= dt;
    ped.walkPhase += dt * 0.12;

    // Flee: a fast car (or a punch) nearby sends them running away from it.
    let fx = 0, fy = 0;
    const dangerX = playerCar ? playerCar.x : p.x;
    const dangerY = playerCar ? playerCar.y : p.y;
    const dangerSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
    const dd = Math.hypot(ped.x - dangerX, ped.y - dangerY);
    if ((playerCar && dangerSpeed > 3 && dd < 110) || ped.flee > 0) {
      fx = (ped.x - dangerX) / (dd || 1); fy = (ped.y - dangerY) / (dd || 1);
      ped.flee = Math.max(ped.flee, 40);
    }
    // Police sirens also scatter pedestrians.
    for (const cop of G.police) {
      const cd = Math.hypot(ped.x - cop.x, ped.y - cop.y);
      if (cd < 90 && Math.abs(cop.speed) > 3) {
        fx += (ped.x - cop.x) / (cd || 1); fy += (ped.y - cop.y) / (cd || 1);
        ped.flee = Math.max(ped.flee, 30);
      }
    }

    let mx, my;
    if (fx || fy) {
      const len = Math.hypot(fx, fy); mx = fx / len; my = fy / len;
      const step = 2.4 * dt;
      const fixed = G.city.collide(ped.x + mx * step, ped.y + my * step, 8, false);
      ped.x = fixed.x; ped.y = fixed.y;
      ped.angle = Math.atan2(mx, -my);
      continue;
    }

    // Stroll along the sidewalk; turn at intersections; sometimes cross.
    const along = ped.vertical ? ped.y : ped.x;
    const nearLine = Math.abs(((along % ROAD_STEP) + ROAD_STEP) % ROAD_STEP) < 10;
    if (nearLine && G.rng.chance(0.002)) {
      ped.dir *= -1;
    }
    if (nearLine && !ped.crossing && G.rng.chance(0.0012)) {
      // Start crossing the road at a zebra.
      ped.crossing = true;
      ped.crossTarget = ped.vertical ? ped.x - ped.side * 2 * (WALK_HALF - 6) : ped.y - ped.side * 2 * (WALK_HALF - 6);
    }
    if (ped.crossing) {
      if (ped.vertical) {
        const step = Math.sign(ped.crossTarget - ped.x) * ped.speed * dt;
        ped.x += step;
        ped.angle = Math.atan2(Math.sign(step), 0);
        if (Math.abs(ped.crossTarget - ped.x) < 4) { ped.crossing = false; ped.side *= -1; }
      } else {
        const step = Math.sign(ped.crossTarget - ped.y) * ped.speed * dt;
        ped.y += step;
        ped.angle = Math.atan2(0, -Math.sign(step));
        if (Math.abs(ped.crossTarget - ped.y) < 4) { ped.crossing = false; ped.side *= -1; }
      }
    } else {
      const step = ped.dir * ped.speed * dt;
      if (ped.vertical) { ped.y += step; ped.angle = ped.dir > 0 ? Math.PI : 0; }
      else { ped.x += step; ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      // Wrap around the world edges so the sidewalks never empty out.
      if (ped.x < 60) ped.x = 3140; if (ped.x > 3140) ped.x = 60;
      if (ped.y < 60) ped.y = 3140; if (ped.y > 3140) ped.y = 60;
    }
    // A car hitting a pedestrian: they get shoved, heat rises (handled by caller via events).
    if (playerCar && Math.abs(playerCar.speed) > 2) {
      const hd = Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y);
      if (hd < 26) {
        ped.flee = 240; ped.angry = 150;
        G.events.push({ type: 'hitPed', x: ped.x, y: ped.y });
        // Knock the pedestrian aside so they are not run over twice.
        ped.x += (ped.x - playerCar.x) * 0.6; ped.y += (ped.y - playerCar.y) * 0.6;
      }
    }
  }
}

export { ROAD_STEP };
