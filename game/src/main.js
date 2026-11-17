// Solcayo — boot and the one loop: input every frame, the world advancing in
// fixed 1/60 s steps, the renderer painting what is there. Screens: title,
// play, pause, busted, wasted, ending. ?shot=chase|street|canal|market
// (&seed=N) stages a deterministic screenshot scene instead of playing.
import { STEP, TUNING, SPOTS, INTRO_LINES } from './config.js';
import { makeRng } from './random.js';
import { createCity } from './city.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createPlayer, updatePlayer, exitVehicle } from './player.js';
import { spawnVehicle, spawnParkedCars, damageVehicle, vehiclesOverlap } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updatePolice, spawnPoliceCar } from './police.js';
import { updateHeat, raiseHeat, setHeat } from './wanted.js';
import { startMission, updateMission, updateTailTarget } from './missions.js';
import {
  garageAction, nearGarage, nearSafehouse, startTaxi, updateTaxi,
  startTimeTrial, updateTimeTrial, updatePostcards, repairCost,
} from './economy.js';
import { createAudio } from './audio.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);

function announce(message) {
  if (statusEl) statusEl.textContent = message;
}

// Build a fresh game state: city, player, cars, traffic, pedestrians, police.
function buildState() {
  const rng = makeRng(seed);
  const city = createCity(rng);
  const G = {
    rng, city, tick: 0, clockMin: 495, // 08:15, a sunny Solcayo morning
    screen: 'title', hasSave: hasSave(),
    cam: { x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, zoom: 1 },
    player: createPlayer(city, SPOTS.safehouse),
    vehicles: [], traffic: [], peds: [], police: [], spikes: [],
    events: [], heat: 0, hiddenTimer: 0,
    mission: null, missionIndex: 0, nextMissionAt: 0,
    missionVan: null, tailTarget: null, roadblockPlaced: false,
    dialog: null, toast: null, toastT: 0,
    owned: ['kancil'], postcardsFound: 0,
    taxi: null, trial: null,
    lastHitPedTick: -999, lastTouchTick: -999,
    nearGarageText: null, endingAt: 0,
    audio: createAudio(),
  };
  G.autosave = () => saveGame(G);
  // Mara's own Kancil, parked by the safehouse; the Lumba waits at the marina.
  const kancil = spawnVehicle(city, 'kancil', 440, 380, 0, { driver: 'none', parked: true });
  const boat = spawnVehicle(city, 'lumba', SPOTS.boatSpawn.x, SPOTS.boatSpawn.y, Math.PI / 2, { driver: 'none', parked: true });
  G.vehicles.push(kancil, boat, ...spawnParkedCars(city, rng));
  G.traffic = spawnTraffic(G, TUNING.trafficCount);
  G.vehicles.push(...G.traffic);
  G.peds = spawnPedestrians(G, TUNING.pedCount);
  // One patrol car cruising near the police station at Heat 0.
  const patrol = spawnPoliceCar(G, SPOTS.policeStation.x + 80, SPOTS.policeStation.y);
  G.police.push(patrol); G.vehicles.push(patrol);
  return G;
}

const G = buildState();
// Tiny debug handle for automated playtests (read-only state inspection).
window.__solcayo = G;

function showToast(G, text) {
  G.toast = text; G.toastT = 180;
}

function doBusted(G) {
  const p = G.player;
  if (p.vehicle) exitVehicle(G);
  p.money = Math.max(0, p.money - TUNING.bustedFine);
  p.health = p.maxHealth;
  p.x = SPOTS.policeStation.x; p.y = SPOTS.policeStation.y + 60;
  setHeat(G, 0);
  G.screen = 'busted';
  showToast(G, `BUSTED — denda $${TUNING.bustedFine}`);
  announce('Busted. Fine paid. Heat reset.');
}

function doWasted(G) {
  const p = G.player;
  if (p.vehicle) exitVehicle(G);
  p.money = Math.max(0, p.money - TUNING.wastedFee);
  p.health = p.maxHealth;
  p.x = SPOTS.safehouse.x; p.y = SPOTS.safehouse.y;
  setHeat(G, 0);
  G.screen = 'wasted';
  showToast(G, `WASTED — biaya klinik $${TUNING.wastedFee}`);
  announce('Wasted. Clinic fee paid.');
}

function processEvents(G) {
  for (const e of G.events) {
    if (e.handled) continue;
    e.handled = true;
    switch (e.type) {
      case 'hitPed':
        if (G.tick - G.lastHitPedTick > 120) {
          raiseHeat(G, 1, 'menabrak pejalan kaki');
          G.lastHitPedTick = G.tick;
          showToast(G, 'Kamu menabrak pejalan kaki! Heat +1');
        }
        break;
      case 'punchPed':
        raiseHeat(G, 1, 'memukul warga');
        showToast(G, 'Kamu memukul warga! Heat +1');
        break;
      case 'punchDriver':
        showToast(G, `Sopir Kessler terhuyung — ${e.left} pukulan lagi!`);
        break;
      case 'driverFled':
        showToast(G, 'Sopir kabur! Naik van Kessler itu!');
        break;
      case 'busted':
        doBusted(G);
        break;
      case 'spike':
        showToast(G, 'Spike strip! Ban bocor — mobil melambat.');
        break;
      case 'roadblock':
        showToast(G, '⚠ Roadblock polisi di depan!');
        break;
      case 'heat':
        if (e.to > e.from) showToast(G, `Heat naik ke ${e.to} — polisi mengejarmu!`);
        break;
      case 'bribe':
        showToast(G, `Damai dibayar $${e.cost}. Heat 0 — polisi bubar.`);
        break;
      case 'missionComplete':
        break; // the banner in the renderer says it
      case 'taxiStart': showToast(G, `Taksi: jemput penumpang — ongkos $${e.fare}`); break;
      case 'taxiPickup': showToast(G, 'Penumpang naik! Antar ke tujuan kuning.'); break;
      case 'taxiDone': showToast(G, `Taksi selesai: +$${e.fare}`); break;
      case 'trialStart': showToast(G, 'Uji Waktu: lewati 3 checkpoint dalam 60 detik!'); break;
      case 'trialDone': showToast(G, `Uji Waktu selesai: +$${e.reward}`); break;
      case 'trialFail': showToast(G, 'Uji Waktu gagal. Coba lagi (Y).'); break;
      case 'postcard': showToast(G, `Kartu Pos Solcayo ${e.found}/12 (+$50)`); break;
      case 'postcardBonus': showToast(G, `Semua 12 kartu pos! Bonus +$${e.bonus}`); break;
      case 'photo': showToast(G, '📸 Foto titik pertemuan didapat! Kabur!'); break;
      case 'repaired': showToast(G, `Mobil diperbaiki ($${e.cost}).`); break;
      case 'bought': showToast(G, `Veloce S dibeli! ($${e.cost}) — terparkir di bengkel.`); break;
      default:
        break;
    }
  }
}

// Bumps between the player's car and street traffic / police.
function handleBumps(G) {
  const p = G.player;
  if (!p.vehicle) return;
  const v = p.vehicle;
  for (const other of G.vehicles) {
    if (other === v || other.hp <= 0) continue;
    if (!vehiclesOverlap(v, other)) continue;
    const relSpeed = Math.abs(v.speed - other.speed);
    // One bump per half-second per car: overlapping cars must not grind
    // each other to scrap in a single second (it wrecked the canal boat).
    if (G.tick - (v.bumpTick || -999) < 30) { v.speed *= 0.96; continue; }
    v.bumpTick = G.tick;
    // A bump is a scrape, not a wreck: small damage, mostly a slowdown.
    if (relSpeed > 3) {
      damageVehicle(v, relSpeed * 0.8);
      if (other.driver === 'npc') damageVehicle(other, relSpeed * 0.8);
      v.speed *= 0.85;
      G.audio.beep(220, 0.1);
    } else {
      v.speed *= 0.96;
    }
  }
  // A wrecked car throws Mara out, hurt.
  if (v.hp <= 0) {
    p.health -= 50;
    exitVehicle(G);
    showToast(G, 'Mobilmu hancur!');
    if (p.health <= 0) doWasted(G);
  }
}

// A police car ramming Mara on foot hurts her.
function handleOnFootTouch(G) {
  const p = G.player;
  if (!p.onFoot || G.heat === 0) return;
  if (G.tick - G.lastTouchTick < 60) return;
  for (const cop of G.police) {
    if (Math.abs(cop.speed) > 3 && Math.hypot(cop.x - p.x, cop.y - p.y) < 34) {
      p.health -= 8;
      G.lastTouchTick = G.tick;
      p.x += (p.x - cop.x) * 0.5; p.y += (p.y - cop.y) * 0.5;
      showToast(G, 'Polisi menabrakmu!');
      if (p.health <= 0) doWasted(G);
      break;
    }
  }
}

function updateCamera(G) {
  const p = G.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  G.cam.x += (px - G.cam.x) * 0.1;
  G.cam.y += (py - G.cam.y) * 0.1;
  const speed = p.vehicle ? Math.abs(p.vehicle.speed) : 0;
  const targetZoom = p.vehicle ? (speed > 5 ? 0.82 : 0.92) : 1.05;
  G.cam.zoom += (targetZoom - G.cam.zoom) * 0.05;
  G.cam.x = Math.max(560, Math.min(2640, G.cam.x));
  G.cam.y = Math.max(340, Math.min(2860, G.cam.y));
}

function tick(G, input) {
  const justPressed = input.pressed ? new Set(input.pressed) : new Set();
  if (input.poll) input.poll();
  G.tick += 1;
  G.clockMin = 495 + Math.floor(G.tick / 360);
  if (input.anyKey) G.audio.ensure();
  if (input.mutePressed) {
    G.audio.setMuted(!G.audio.muted);
    showToast(G, G.audio.muted ? 'Suara mati (M).' : 'Suara hidup (M).');
  }
  // Dialog lines advance one at a time.
  if (G.dialog) {
    G.dialog.t += 1;
    if (G.dialog.t > 300) {
      G.dialog.shown += 1; G.dialog.t = 0;
      if (G.dialog.shown >= G.dialog.lines.length) G.dialog = null;
    }
  }
  if (G.toastT > 0) { G.toastT -= 1; if (G.toastT === 0) G.toast = null; }

  if (G.screen === 'title') {
    if (justPressed.has('enter') || input.consumeClick?.()) {
      if (G.hasSave) continueGame(); else newGame();
    } else if (justPressed.has('n')) newGame();
    return;
  }
  if (G.screen === 'pause') {
    if (input.pausePressed || justPressed.has('enter')) G.screen = 'play';
    else if (justPressed.has('s')) { saveGame(G); showToast(G, 'Permainan disimpan.'); }
    else if (justPressed.has('q')) { G.screen = 'title'; G.hasSave = hasSave(); }
    return;
  }
  if (G.screen === 'busted' || G.screen === 'wasted') {
    if (justPressed.has('enter')) G.screen = 'play';
    return;
  }
  if (G.screen === 'ending') {
    if (justPressed.has('enter')) G.screen = 'play';
    return;
  }
  if (G.screen !== 'play') return;

  if (input.pausePressed) { G.screen = 'pause'; announce('Paused.'); return; }

  updatePlayer(G, input, 1);
  updateTraffic(G, 1);
  updatePedestrians(G, 1);
  updatePolice(G, 1);
  updateHeat(G, 1);
  updateMission(G, 1);
  updateTailTarget(G, 1);
  updateTaxi(G, 1);
  updateTimeTrial(G, 1);
  updatePostcards(G);
  handleBumps(G);
  handleOnFootTouch(G);
  processEvents(G);

  // Garage menu (keys 1/2/3) and safehouse save (E) near the spots.
  G.nearGarageText = null;
  if (nearGarage(G)) {
    const p = G.player;
    const parts = [];
    if (p.vehicle) parts.push(`[1] Perbaiki $${repairCost(p.vehicle)}`);
    if (G.heat > 0) parts.push(`[2] Damai $${G.heat * TUNING.bribePerHeat}`);
    if (!G.owned.includes('veloce')) parts.push('[3] Beli Veloce S $3000');
    G.nearGarageText = parts.length ? `🔧 Venn & Sons — ${parts.join(' · ')}` : '🔧 Venn & Sons — bengkel Dario';
    for (const d of ['1', '2', '3']) if (justPressed.has(d)) garageAction(G, d);
  }
  if (nearSafehouse(G)) {
    G.nearGarageText = '🏠 Safehouse — tekan E untuk simpan + hilangkan Heat';
    if (input.interactPressed) {
      saveGame(G);
      if (G.heat > 0) { setHeat(G, 0); showToast(G, 'Disimpan di safehouse. Heat hilang.'); }
      else showToast(G, 'Disimpan di safehouse.');
    }
  }
  // Side jobs on demand.
  if (justPressed.has('t') && G.player.vehicle && !G.taxi?.active) startTaxi(G);
  if (justPressed.has('y') && G.player.vehicle && !G.trial?.active) startTimeTrial(G);

  // Ending: mission 6 done, banner shown, then the ending screen.
  if (G.mission?.justCompleted?.id === 6 && G.endingAt === 0) G.endingAt = G.tick + 300;
  if (G.endingAt && G.tick >= G.endingAt) { G.endingAt = 0; G.screen = 'ending'; }

  // Sound follows the car and the sirens.
  const pv = G.player.vehicle;
  G.audio.engine(pv ? pv.speed : 0, pv ? pv.def.top : 1);
  G.audio.updateSiren(G.tick);
  G.audio.updateMusic(1, G.tick);

  updateCamera(G);
  // Expire one-shot events so the renderer only flashes them briefly.
  for (const e of G.events) e.ttl = (e.ttl ?? 25) - 1;
  G.events = G.events.filter((e) => e.ttl > 0);
  if (G.mission?.bannerT > 0) G.mission.bannerT -= 1;
}

function newGame() {
  const fresh = buildState();
  for (const k of Object.keys(fresh)) G[k] = fresh[k];
  G.screen = 'play';
  G.missionIndex = 1;
  startMission(G, 1);
  G.dialog = { lines: INTRO_LINES, shown: 0, t: 0 };
  announce('Solcayo. Mission 1: Paket Pertama.');
}

function continueGame() {
  const fresh = buildState();
  for (const k of Object.keys(fresh)) G[k] = fresh[k];
  loadSave(G);
  G.screen = 'play';
  if (G.missionIndex >= 1 && G.missionIndex <= 6) startMission(G, G.missionIndex);
  announce('Welcome back to Solcayo.');
}

function runShot(name) {
  stageShot(G, name, (input) => tick(G, input));
  let painted = 0;
  function paint() {
    renderer.draw(G);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  input.attach(canvas);
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // tick() runs on every screen: it owns the pause menu's keys too, so the
    // loop must never skip it while paused (a frozen pause screen is a trap).
    while (accumulator >= STEP) {
      tick(G, input);
      accumulator -= STEP;
    }
    renderer.draw(G);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') G.screen = 'pause';
  });
  announce('Solcayo. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shotName) runShot(shotName);
else runGame();
