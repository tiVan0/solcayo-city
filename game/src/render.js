// Solcayo — everything the player sees: the sun-soaked city, cars, people,
// effects, the full HUD (heat, health, money, mission banner, Dario's calls),
// the round minimap, and every menu screen.
import {
  WORLD, ROAD_STEP, ROAD_HALF, CANAL_Y0, CANAL_Y1, CANAL_X0, CANAL_X1,
  BRIDGES, PALETTE, DISTRICTS, districtAt, SPOTS,
} from './config.js';
import { lightPhase } from './city.js';
import { missionLabel, currentStage } from './missions.js';

const VIEW_W = 1280, VIEW_H = 720;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawWorld(G) {
    const cam = G.cam;
    const scale = cam.zoom * (canvas.width / VIEW_W);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-cam.x + VIEW_W / 2, -cam.y + VIEW_H / 2);

    // Ground: grass with a subtle checker of mown strips.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x - VIEW_W / 2 - 40, cam.y - VIEW_H / 2 - 40, VIEW_W + 80, VIEW_H + 80);
    ctx.fillStyle = PALETTE.grassAlt;
    const gx0 = Math.max(0, Math.floor((cam.x - VIEW_W / 2) / 200) * 200);
    const gy0 = Math.max(0, Math.floor((cam.y - VIEW_H / 2) / 200) * 200);
    for (let x = gx0; x < cam.x + VIEW_W / 2; x += 400) {
      for (let y = gy0; y < cam.y + VIEW_H / 2; y += 400) {
        if (((x + y) / 200) % 2 === 0) ctx.fillRect(x, y, 200, 200);
      }
    }
    // District tint wash (very light, so the map reads at a glance).
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint + '22';
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }

    drawRoads(G);
    drawCanal(G);
    drawBuildings(G);
    drawTrees(G);
    drawSpots(G);
    drawPostcards(G);
    drawZebrasAndLights(G);
    drawRouteLine(G);
    for (const v of G.vehicles) drawVehicle(G, v);
    for (const ped of G.peds) drawPed(G, ped);
    drawPlayer(G);
    drawEffects(G);
    ctx.restore();
  }

  function drawRoads() {
    // Sidewalk first (wider), then asphalt, then centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let k = 0; k <= 8; k++) {
      const c = k * ROAD_STEP;
      ctx.fillRect(0, c - ROAD_HALF - 18, WORLD, (ROAD_HALF + 18) * 2);
      ctx.fillRect(c - ROAD_HALF - 18, 0, (ROAD_HALF + 18) * 2, WORLD);
    }
    ctx.fillStyle = PALETTE.road;
    for (let k = 0; k <= 8; k++) {
      const c = k * ROAD_STEP;
      ctx.fillRect(0, c - ROAD_HALF, WORLD, ROAD_HALF * 2);
      ctx.fillRect(c - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
    }
    ctx.fillStyle = PALETTE.roadLine;
    for (let k = 0; k <= 8; k++) {
      const c = k * ROAD_STEP;
      for (let s = 60; s < WORLD; s += 120) {
        ctx.fillRect(s, c - 2, 46, 4);
        ctx.fillRect(c - 2, s, 4, 46);
      }
    }
  }

  function drawCanal(G) {
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(CANAL_X0, CANAL_Y0, CANAL_X1 - CANAL_X0, CANAL_Y1 - CANAL_Y0);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(CANAL_X0, CANAL_Y0 + 8, CANAL_X1 - CANAL_X0, CANAL_Y1 - CANAL_Y0 - 16);
    // Animated wave strokes.
    ctx.strokeStyle = PALETTE.wave;
    ctx.lineWidth = 2;
    for (let x = CANAL_X0 + 40; x < CANAL_X1; x += 130) {
      const wob = Math.sin((G.tick + x) * 0.05) * 4;
      ctx.beginPath();
      ctx.moveTo(x, CANAL_Y0 + 30 + wob);
      ctx.quadraticCurveTo(x + 20, CANAL_Y0 + 24 + wob, x + 44, CANAL_Y0 + 30 + wob);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 60, CANAL_Y1 - 30 - wob);
      ctx.quadraticCurveTo(x + 80, CANAL_Y1 - 24 - wob, x + 104, CANAL_Y1 - 30 - wob);
      ctx.stroke();
    }
    // Banks.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(CANAL_X0, CANAL_Y0 - 10, CANAL_X1 - CANAL_X0, 10);
    ctx.fillRect(CANAL_X0, CANAL_Y1, CANAL_X1 - CANAL_X0, 10);
    // Bridges (road over water) + docks.
    ctx.fillStyle = PALETTE.road;
    for (const bx of BRIDGES) ctx.fillRect(bx - ROAD_HALF, CANAL_Y0 - 6, ROAD_HALF * 2, CANAL_Y1 - CANAL_Y0 + 12);
    ctx.fillStyle = '#a9805a';
    for (const d of G.city.docks) ctx.fillRect(d.x, d.y, d.w, d.h);
  }

  function drawBuildings(G) {
    for (const b of G.city.buildings) {
      // Long afternoon shadow, always east (+x): one light direction.
      ctx.fillStyle = 'rgba(40,30,20,0.22)';
      ctx.fillRect(b.x + 12, b.y + 16, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Windows.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i + j) % 3 !== 0) continue;
          ctx.fillRect(b.x + 8 + i * 24, b.y + 8 + j * 24, 12, 12);
        }
      }
      if (b.roof) {
        ctx.fillStyle = PALETTE.buildingRoof;
        ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
      }
    }
    for (const c of G.city.containers) {
      ctx.fillStyle = 'rgba(40,30,20,0.22)';
      ctx.fillRect(c.x + 8, c.y + 10, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(c.x + (c.w / 4) * i, c.y); ctx.lineTo(c.x + (c.w / 4) * i, c.y + c.h); ctx.stroke();
      }
    }
  }

  function drawTrees(G) {
    for (const t of G.city.trees) {
      ctx.fillStyle = PALETTE.trunk;
      ctx.fillRect(t.x - 2, t.y - 2, 4, 10);
      ctx.fillStyle = t.palm ? PALETTE.palm : PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 6, 11 * t.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,30,20,0.18)';
      ctx.beginPath();
      ctx.arc(t.x + 8, t.y + 4, 10 * t.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSpots() {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const spots = [
      [SPOTS.garage, '🔧'], [SPOTS.safehouse, '🏠'], [SPOTS.policeStation, '🚔'],
      [SPOTS.newsOffice, '📰'], [SPOTS.marinaDock, '⚓'], [SPOTS.market, '🧺'],
      [SPOTS.portGate, '📦'], [SPOTS.plaza, '⛲'],
    ];
    for (const [s, icon] of spots) {
      const text = `${icon} ${s.label}`;
      const w = ctx.measureText(text).width + 20;
      ctx.fillStyle = 'rgba(12,18,28,0.55)';
      rr(ctx, s.x - w / 2, s.y - 34, w, 26, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, s.x, s.y - 15);
    }
  }

  function drawPostcards(G) {
    for (const c of G.city.postcards) {
      if (c.taken) continue;
      const bob = Math.sin(G.tick * 0.08 + c.id) * 3;
      ctx.fillStyle = '#fff';
      rr(ctx, c.x - 11, c.y - 14 + bob, 22, 28, 3); ctx.fill();
      ctx.fillStyle = '#e8b23a';
      ctx.fillRect(c.x - 8, c.y - 11 + bob, 16, 12);
      ctx.fillStyle = '#2f6df6';
      ctx.fillRect(c.x - 8, c.y + 4 + bob, 16, 3);
    }
  }

  function drawZebrasAndLights(G) {
    // Zebra stripes at lit intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const z of G.city.zebras) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(z.x + i * 12 - 4, z.y - ROAD_HALF - 6, 8, 12);
        ctx.fillRect(z.x - ROAD_HALF - 6, z.y + i * 12 - 4, 12, 8);
      }
    }
    // Traffic lights: pole + three lamps, the active one glowing.
    for (const light of G.city.lights) {
      const phase = lightPhase(G.tick + light.offset);
      const lx = light.x + ROAD_HALF + 8, ly = light.y - ROAD_HALF - 8;
      ctx.fillStyle = '#222';
      ctx.fillRect(lx - 3, ly - 6, 6, 34);
      ctx.fillStyle = '#111';
      rr(ctx, lx - 8, ly - 26, 16, 30, 4); ctx.fill();
      const colors = ['#ff3b30', '#ffd94d', '#37c978'];
      const active = phase === 'ns' || phase === 'ew' ? 2 : phase.endsWith('Y') ? 1 : 0;
      colors.forEach((c, i) => {
        ctx.fillStyle = i === active ? c : '#333';
        ctx.beginPath(); ctx.arc(lx, ly - 20 + i * 9, 4, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  function drawRouteLine(G) {
    const s = currentStage(G);
    if (!s || !s.x) return;
    const p = G.player;
    const px = p.vehicle ? p.vehicle.x : p.x;
    const py = p.vehicle ? p.vehicle.y : p.y;
    ctx.strokeStyle = PALETTE.waypoint;
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.setLineDash([]);
    // Waypoint beacon: pulsing ring + diamond.
    const pulse = 1 + Math.sin(G.tick * 0.1) * 0.15;
    ctx.strokeStyle = PALETTE.waypoint;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE.waypoint;
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function drawVehicle(G, v) {
    const def = v.def;
    ctx.save();
    ctx.translate(v.x, v.y);
    // Shadow.
    ctx.fillStyle = 'rgba(40,30,20,0.25)';
    ctx.beginPath(); ctx.ellipse(8, 10, def.l / 2, def.w / 2, v.angle, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(v.angle);
    // Skid marks.
    if (v.skid > 0) {
      ctx.strokeStyle = 'rgba(20,20,20,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-def.l / 2, -def.w / 2); ctx.lineTo(-def.l / 2 - 14, -def.w / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-def.l / 2, def.w / 2); ctx.lineTo(-def.l / 2 - 14, def.w / 2); ctx.stroke();
    }
    // Body.
    ctx.fillStyle = v.color;
    rr(ctx, -def.l / 2, -def.w / 2, def.l, def.w, 9); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-def.l / 2 + 4, -def.w / 2 + 4, def.l - 8, 8);
    // Windshield + roof.
    ctx.fillStyle = '#bfe0ee';
    ctx.fillRect(-def.l / 4, -def.w / 2 + 5, def.l / 5, def.w - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-def.l / 8, -def.w / 2 + 6, def.l / 4, def.w - 12);
    // Wheels.
    ctx.fillStyle = '#151515';
    const wy = def.w / 2 - 2;
    ctx.fillRect(-def.l / 3, -wy - 3, 12, 6); ctx.fillRect(-def.l / 3, wy - 3, 12, 6);
    ctx.fillRect(def.l / 4, -wy - 3, 12, 6); ctx.fillRect(def.l / 4, wy - 3, 12, 6);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(def.l / 2 - 3, -def.w / 2 + 4, 4, 6);
    ctx.fillRect(def.l / 2 - 3, def.w / 2 - 10, 4, 6);
    // Police light bar.
    if (v.driver === 'police') {
      const flash = Math.floor(G.tick / 10) % 2 === 0;
      ctx.fillStyle = flash ? PALETTE.policeRed : PALETTE.policeBlue;
      ctx.fillRect(-6, -def.w / 2 + 2, 12, 6);
      ctx.fillStyle = flash ? PALETTE.policeBlue : PALETTE.policeRed;
      ctx.fillRect(-6, def.w / 2 - 8, 12, 6);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLISI', 0, 4);
    }
    if (v.locked) {
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', 0, -def.w / 2 - 8);
    }
    // Smoke when damaged.
    if (v.smoke > 0 && v.hp < v.maxHp * 0.5) {
      ctx.fillStyle = 'rgba(120,120,120,0.6)';
      ctx.beginPath(); ctx.arc(-def.l / 3 + Math.sin(G.tick * 0.2) * 4, -def.w / 3, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Honk bubble.
    if (v.honk > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📣!', v.x, v.y - def.w);
    }
  }

  function drawPed(G, ped) {
    const bob = Math.sin(ped.walkPhase * 6) * 1.5;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob);
    ctx.fillStyle = 'rgba(40,30,20,0.25)';
    ctx.beginPath(); ctx.ellipse(3, 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Body + head.
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(Math.sin(ped.angle) * 2, -Math.cos(ped.angle) * 2 - 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (ped.angry > 0) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 20);
    }
  }

  function drawPlayer(G) {
    const p = G.player;
    if (p.vehicle) return; // drawn as part of the car
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(40,30,20,0.3)';
    ctx.beginPath(); ctx.ellipse(4, 6, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    // Mara: red jacket, dark hair, unmistakable.
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(0, -4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -7, 4, 0, Math.PI * 2); ctx.fill();
    // Punch arc.
    if (p.punchAnim > 0) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, -14, 14, -0.9, 0.9); ctx.stroke();
    }
    ctx.restore();
    // White ring so the player is always findable.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 15 + Math.sin(G.tick * 0.08) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  function drawEffects(G) {
    for (const e of G.events) {
      if (e.type === 'punchPed' || e.type === 'punchDriver') {
        ctx.fillStyle = '#ffd94d';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥', e.x, e.y - 18);
      }
    }
    for (const s of G.spikes) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = '#222';
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * 8, -6); ctx.lineTo(i * 8 + 4, 0); ctx.lineTo(i * 8, 6); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawHUD(G) {
    const p = G.player;
    ctx.textAlign = 'left';
    // Top-left panel: heat stars + health.
    ctx.fillStyle = PALETTE.hudBg;
    rr(ctx, 14, 14, 250, 64, 10); ctx.fill();
    for (let i = 0; i < 5; i++) {
      star(ctx, 34 + i * 26, 40, 11, i < G.heat ? PALETTE.heat : 'rgba(255,255,255,0.25)');
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(G.heat === 0 ? 'HEAT 0 — aman' : `HEAT ${G.heat}`, 30, 68);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(150, 58, 100, 10);
    ctx.fillStyle = p.health > 30 ? '#37c978' : '#ff3b30';
    ctx.fillRect(150, 58, 100 * (p.health / p.maxHealth), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`❤ ${Math.ceil(p.health)}`, 150, 52);

    // Top-right: money, reputation, clock, district.
    const money = `$${Math.floor(p.money).toLocaleString('en-US')}`;
    ctx.fillStyle = PALETTE.hudBg;
    rr(ctx, VIEW_W - 264, 14, 250, 76, 10); ctx.fill();
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(money, VIEW_W - 30, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    const repStars = '★'.repeat(p.rep) + '☆'.repeat(5 - p.rep);
    ctx.fillText(`Rep ${repStars}`, VIEW_W - 30, 58);
    const mins = G.clockMin % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    ctx.fillText(`${hh}:${mm} · ${districtAt(p.x, p.y)}`, VIEW_W - 30, 78);

    // Mission banner, top-centre.
    const s = currentStage(G);
    if (s && G.mission?.active) {
      const label = missionLabel(G);
      ctx.font = 'bold 16px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 36;
      ctx.fillStyle = PALETTE.hudBg;
      rr(ctx, VIEW_W / 2 - w / 2, 14, w, 40, 10); ctx.fill();
      ctx.fillStyle = PALETTE.waypoint;
      ctx.textAlign = 'center';
      ctx.fillText(`🎯 ${label}`, VIEW_W / 2, 40);
      const pos = p.vehicle ? { x: p.vehicle.x, y: p.vehicle.y } : p;
      if (s.x) {
        const d = Math.round(Math.hypot(s.x - pos.x, s.y - pos.y));
        ctx.fillStyle = '#fff';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(`${d}m`, VIEW_W / 2, 58);
      }
      if (s.kind === 'timed' && G.mission.timer > 0) {
        ctx.fillStyle = G.mission.timer < 600 ? '#ff5a3c' : '#fff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(`⏱ ${Math.ceil(G.mission.timer / 60)} dtk`, VIEW_W / 2, 76);
      }
      if (s.kind === 'tail') {
        const pct = Math.min(100, Math.round((G.mission.tailProgress / (s.seconds * 60)) * 100));
        ctx.fillStyle = '#fff';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(`Mengikuti… ${pct}%`, VIEW_W / 2, 76);
      }
    }

    // Bottom-left: speed + vehicle.
    if (p.vehicle) {
      const v = p.vehicle;
      ctx.fillStyle = PALETTE.hudBg;
      rr(ctx, 14, VIEW_H - 66, 250, 52, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(Math.abs(v.speed) * 18)} km/j`, 30, VIEW_H - 32);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(v.def.name, 130, VIEW_H - 32);
      // Condition bar.
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(130, VIEW_H - 52, 110, 8);
      ctx.fillStyle = v.hp > v.maxHp * 0.4 ? '#37c978' : '#ff3b30';
      ctx.fillRect(130, VIEW_H - 52, 110 * (v.hp / v.maxHp), 8);
    } else {
      ctx.fillStyle = PALETTE.hudBg;
      rr(ctx, 14, VIEW_H - 66, 250, 52, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🚶 Mara — jalan kaki', 30, VIEW_H - 44);
      if (p.nearVehicle) ctx.fillText(`E — naik ${p.nearVehicle.def.name}${p.nearVehicle.locked ? ' 🔒' : ''}`, 30, VIEW_H - 26);
      else if (p.nearBoat) ctx.fillText('E — naik speedboat Lumba', 30, VIEW_H - 26);
      else ctx.fillText('WASD jalan · Shift lari · Space tinju', 30, VIEW_H - 26);
    }

    // Dario's phone call, bottom-centre.
    if (G.dialog && G.dialog.shown < G.dialog.lines.length) {
      const line = G.dialog.lines[G.dialog.shown];
      ctx.font = '15px system-ui, sans-serif';
      const w = Math.min(640, ctx.measureText(line).width + 48);
      ctx.fillStyle = 'rgba(20,28,44,0.88)';
      rr(ctx, VIEW_W / 2 - w / 2, VIEW_H - 118, w, 44, 10); ctx.fill();
      ctx.fillStyle = '#8fd0ff';
      ctx.textAlign = 'center';
      ctx.fillText(`📞 ${line}`, VIEW_W / 2, VIEW_H - 90);
    }

    // Garage / safehouse prompts.
    if (G.nearGarageText) {
      ctx.fillStyle = PALETTE.hudBg;
      rr(ctx, VIEW_W / 2 - 220, VIEW_H - 168, 440, 44, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(G.nearGarageText, VIEW_W / 2, VIEW_H - 140);
    }
    if (G.toast) {
      ctx.fillStyle = 'rgba(20,28,44,0.85)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(G.toast).width + 36;
      rr(ctx, VIEW_W / 2 - w / 2, 96, w, 34, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(G.toast, VIEW_W / 2, 118);
    }

    drawMinimap(G);
  }

  function drawMinimap(G) {
    const cx = VIEW_W - 96, cy = VIEW_H - 96, R = 82;
    const scale = (R * 2) / WORLD;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // Water band + roads.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(cx - R, cy + (CANAL_Y0 - WORLD / 2) * scale, R * 2, (CANAL_Y1 - CANAL_Y0) * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 8; k++) {
      const c = k * ROAD_STEP * scale;
      ctx.beginPath(); ctx.moveTo(cx - R, cy - R + c); ctx.lineTo(cx + R, cy - R + c); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R + c, cy - R); ctx.lineTo(cx - R + c, cy + R); ctx.stroke();
    }
    // Search zone at Heat 5.
    if (G.heat >= 5) {
      ctx.strokeStyle = 'rgba(255,60,60,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.stroke();
    }
    // Waypoint.
    const s = currentStage(G);
    if (s && s.x) {
      ctx.fillStyle = PALETTE.waypoint;
      ctx.beginPath(); ctx.arc(cx - R + s.x * scale, cy - R + s.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Police blips (flashing).
    const flash = Math.floor(G.tick / 15) % 2 === 0;
    for (const cop of G.police) {
      ctx.fillStyle = flash ? PALETTE.policeRed : PALETTE.policeBlue;
      ctx.beginPath(); ctx.arc(cx - R + cop.x * scale, cy - R + cop.y * scale, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player.
    const p = G.player;
    const px = p.vehicle ? p.vehicle.x : p.x;
    const py = p.vehicle ? p.vehicle.y : p.y;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - R + px * scale, cy - R + py * scale, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Rim + compass.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - R - 8);
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(10,16,26,0.82)';
    rr(ctx, VIEW_W / 2 - 320, VIEW_H / 2 - 170, 640, 340, 16); ctx.fill();
    ctx.strokeStyle = accent || PALETTE.waypoint;
    ctx.lineWidth = 3;
    rr(ctx, VIEW_W / 2 - 320, VIEW_H / 2 - 170, 640, 340, 16); ctx.stroke();
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 - 60 + i * 30));
  }

  function drawMenus(G) {
    const p = G.player;
    if (G.screen === 'title') {
      // Sunset gradient backdrop + title.
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, PALETTE.skyTop);
      grad.addColorStop(0.6, '#f2a35e');
      grad.addColorStop(1, PALETTE.skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#2b2b2b';
      ctx.font = 'bold 96px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SOLCAYO', VIEW_W / 2, 240);
      ctx.fillStyle = '#fff';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText('kota di mana sungai bertemu laut', VIEW_W / 2, 285);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Mara Voss, 27 — mantan kurir paket. Kini sopir lepas untuk siapa pun yang membayar.', VIEW_W / 2, 330);
      ctx.fillText('Curi mobil. Antar paket. Kabur dari Komisaris Ibarra dan Kessler Group.', VIEW_W / 2, 356);
      const has = G.hasSave;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(has ? '▶  Lanjutkan  (Enter)      🆕  Permainan Baru  (N)' : '▶  Permainan Baru  (Enter)', VIEW_W / 2, VIEW_H / 2 + 120);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText('WASD jalan/nyetir · E naik mobil · Space tinju/handbrake · Esc jeda · M bisu', VIEW_W / 2, VIEW_H / 2 + 160);
    } else if (G.screen === 'pause') {
      drawWorld(G); drawHUD(G);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('JEDA', ['Esc — lanjutkan', 'S — simpan permainan', 'Q — kembali ke judul'], PALETTE.hudGold);
    } else if (G.screen === 'busted') {
      drawWorld(G);
      ctx.fillStyle = 'rgba(10,16,26,0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('BUSTED!', ['Komisaris Ibarra menangkapmu. Denda $150.', 'Heat direset. Tekan Enter untuk lanjut.'], PALETTE.policeBlue);
    } else if (G.screen === 'wasted') {
      drawWorld(G);
      ctx.fillStyle = 'rgba(10,16,26,0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('WASTED', ['Mara dirawat di klinik. Biaya $100.', 'Tekan Enter untuk lanjut.'], PALETTE.heat);
    } else if (G.screen === 'ending') {
      ctx.fillStyle = '#101826';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('JALAN PULANG PANJANG — TAMAT', [
        'Bukti korupsi Kessler tayang di berita pagi ini.',
        `Misi selesai: ${p.missionsDone} · Mobil dicuri: ${p.carsStolen}`,
        `Jarak tempuh: ${Math.round(p.distanceDriven / 60)} m · Uang: $${Math.floor(p.money)}`,
        'Solcayo bebas — untuk sekarang. Free roam terbuka!',
        'Tekan Enter untuk terus menjelajah.',
      ], PALETTE.hudGold);
    }
  }

  function drawMissionBanner(G) {
    if (!G.mission?.justCompleted || G.mission.bannerT <= 0) return;
    const def = G.mission.justCompleted;
    ctx.fillStyle = 'rgba(20,40,20,0.88)';
    rr(ctx, VIEW_W / 2 - 260, VIEW_H / 2 - 90, 520, 84, 12); ctx.fill();
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`✓ MISI SELESAI — ${def.name}`, VIEW_W / 2, VIEW_H / 2 - 56);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`+$${def.reward} · Reputasi +${def.rep}`, VIEW_W / 2, VIEW_H / 2 - 26);
  }

  return {
    draw(G) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const scaleX = canvas.width / VIEW_W;
      const scaleY = canvas.height / VIEW_H;
      const s = Math.min(scaleX, scaleY);
      ctx.setTransform(s, 0, 0, s, (canvas.width - VIEW_W * s) / 2, (canvas.height - VIEW_H * s) / 2);
      ctx.fillStyle = '#101826';
      ctx.fillRect(-100, -100, VIEW_W + 200, VIEW_H + 200);
      if (G.screen === 'play' || G.screen === 'pause' || G.screen === 'busted' || G.screen === 'wasted') {
        drawWorld(G);
        drawHUD(G);
      }
      if (G.screen !== 'play') drawMenus(G);
      // The mission banner is a gameplay overlay, never over a menu.
      if (G.screen === 'play') drawMissionBanner(G);
    },
  };
}
