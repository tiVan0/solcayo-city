// Solcayo — the city: road grid, canal + bridges, districts, buildings,
// traffic lights, zebra crossings, trees, postcards and collision helpers.
import {
  WORLD, ROAD_STEP, ROAD_HALF, WALK_HALF, CANAL_Y0, CANAL_Y1, CANAL_X0, CANAL_X1,
  BRIDGES, PALETTE, DISTRICTS, POSTCARD_SPOTS, SPOTS,
} from './config.js';
import { hash2 } from './random.js';

export function isRoadPoint(x, y) {
  const rx = ((x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  const ry = ((y % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
  const dx = Math.min(rx, ROAD_STEP - rx);
  const dy = Math.min(ry, ROAD_STEP - ry);
  return dx <= ROAD_HALF || dy <= ROAD_HALF;
}

export function isWaterPoint(x, y) {
  if (x < CANAL_X0 || x > CANAL_X1 || y < CANAL_Y0 || y > CANAL_Y1) return false;
  for (const bx of BRIDGES) if (Math.abs(x - bx) <= ROAD_HALF) return false;
  return true;
}

export function onBridge(x, y) {
  if (y < CANAL_Y0 || y > CANAL_Y1) return false;
  return BRIDGES.some((bx) => Math.abs(x - bx) <= ROAD_HALF);
}

export function nearestRoadLine(v) {
  return Math.round(v / ROAD_STEP) * ROAD_STEP;
}

// Traffic light cycle: 360 ticks. NS green 0-150, NS yellow 150-180,
// EW green 180-330, EW yellow 330-360.
export function lightPhase(tick) {
  const t = tick % 360;
  if (t < 150) return 'ns';
  if (t < 180) return 'nsY';
  if (t < 330) return 'ew';
  return 'ewY';
}

export function createCity(rng) {
  const buildings = [];
  const trees = [];
  const containers = [];
  const docks = [];
  const lights = [];
  const zebras = [];

  // Traffic lights at the six big intersections (not on the canal bridges).
  for (const lx of [800, 1600, 2400]) {
    for (const ly of [800, 2400]) {
      lights.push({ x: lx, y: ly, offset: (lx + ly) % 360 });
      zebras.push({ x: lx, y: ly });
    }
  }
  // Extra zebra crossings at mid-block canal bridges.
  for (const bx of BRIDGES) zebras.push({ x: bx, y: (CANAL_Y0 + CANAL_Y1) / 2 });

  const blockColors = [PALETTE.buildingGlass, PALETTE.buildingBrick, PALETTE.buildingCream];
  for (let bi = 0; bi < 8; bi++) {
    for (let bj = 0; bj < 8; bj++) {
      const x0 = bi * ROAD_STEP + 64, y0 = bj * ROAD_STEP + 64;
      const x1 = (bi + 1) * ROAD_STEP - 64, y1 = (bj + 1) * ROAD_STEP - 64;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = DISTRICTS.find((d) => cx >= d.x0 && cx < d.x1 && cy >= d.y0 && cy < d.y1);
      const roll = rng.next();
      // Port district: container yards instead of buildings.
      if (district && district.name === 'Pelabuhan' && roll < 0.75) {
        for (let i = 0; i < 5; i++) {
          containers.push({
            x: x0 + 10 + (i % 3) * 90, y: y0 + 14 + Math.floor(i / 3) * 110,
            w: 78, h: 40, color: [PALETTE.containerA, PALETTE.containerB, PALETTE.containerC][i % 3],
          });
        }
        continue;
      }
      // Some blocks are parks / plazas with palms and trees.
      if (roll < 0.14) {
        for (let i = 0; i < 6; i++) {
          trees.push({ x: x0 + 30 + rng.range(0, 210), y: y0 + 30 + rng.range(0, 210), palm: rng.chance(0.6), s: rng.range(0.8, 1.3) });
        }
        continue;
      }
      // Normal block: 1-3 buildings, deterministic-ish placement.
      const n = 1 + Math.floor(rng.next() * 3);
      for (let i = 0; i < n; i++) {
        const bw = rng.range(70, 130), bh = rng.range(70, 130);
        const bx = x0 + rng.range(6, Math.max(7, x1 - x0 - bw - 6));
        const by = y0 + rng.range(6, Math.max(7, y1 - y0 - bh - 6));
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: rng.pick(blockColors),
          roof: rng.chance(0.5),
          hgt: rng.range(0.7, 1.4),
          windows: Math.floor(hash2(bi, bj * 10 + i, 7) * 5) + 3,
        });
      }
      // Street trees along the block edge.
      if (rng.chance(0.7)) {
        trees.push({ x: x0 + 8, y: y0 + 8, palm: rng.chance(0.5), s: 1 });
        trees.push({ x: x1 - 8, y: y1 - 8, palm: rng.chance(0.5), s: 1 });
      }
    }
  }

  // Marina docks: wooden piers jutting into the canal on both banks.
  for (const dx of [500, 1100, 2000, 2700]) {
    docks.push({ x: dx, y: CANAL_Y0 - 26, w: 90, h: 26 });
    docks.push({ x: dx + 60, y: CANAL_Y1, w: 90, h: 26 });
  }

  const postcards = POSTCARD_SPOTS.map(([x, y], i) => ({ x, y, id: i, taken: false }));

  const city = {
    buildings, trees, containers, docks, lights, zebras, postcards,
    spots: SPOTS,
    isRoad: isRoadPoint,
    isWater: isWaterPoint,
    // Push a circle out of buildings, containers, world bounds and (for land
    // movers) water. Returns the corrected position.
    collide(x, y, r, inWater) {
      let nx = x, ny = y;
      nx = Math.max(r, Math.min(WORLD - r, nx));
      ny = Math.max(r, Math.min(WORLD - r, ny));
      if (!inWater && isWaterPoint(nx, ny)) {
        // Step back towards the nearest bank.
        if (ny < (CANAL_Y0 + CANAL_Y1) / 2) ny = CANAL_Y0 - r; else ny = CANAL_Y1 + r;
      }
      const solids = buildings.concat(containers);
      for (const b of solids) {
        const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
        const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
        const dx = nx - cx, dy = ny - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 === 0) { ny = b.y - r; continue; }
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r; ny = cy + (dy / d) * r;
        }
      }
      return { x: nx, y: ny };
    },
    // Is a point inside any building/container? (used for spawn validation)
    insideSolid(x, y) {
      for (const b of buildings) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
      for (const b of containers) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
      return false;
    },
    // Parking spots along road edges (parallel-parked, never inside a block).
    parkingSpots: [
      { x: 430, y: 2380, angle: Math.PI / 2 }, { x: 430, y: 1000, angle: Math.PI / 2 },
      { x: 770, y: 430, angle: 0 }, { x: 1570, y: 1000, angle: Math.PI / 2 },
      { x: 2370, y: 430, angle: 0 }, { x: 2830, y: 2200, angle: Math.PI / 2 },
      { x: 1170, y: 2830, angle: 0 }, { x: 1970, y: 2830, angle: 0 },
      { x: 2830, y: 1170, angle: Math.PI / 2 }, { x: 430, y: 2830, angle: Math.PI / 2 },
    ],
  };
  return city;
}

export { WALK_HALF };
