// Solcayo — the four deterministic screenshot scenes behind ?shot=.
// Each one stages the real game (same code, same seed), plays it forward
// with a small autopilot, and leaves a dense, readable frame behind.
//   chase  — Heat 3 chase through Downtown (the cover)
//   street — Mara on foot in Pasar Tua, a living intersection
//   canal  — the Lumba speedboat on the Marina canal at sunset
//   market — mission 4: stealing the Kessler van at the port
import { SPOTS } from './config.js';
import { spawnVehicle, damageVehicle } from './vehicles.js';
import { startMission } from './missions.js';
import { setHeat } from './wanted.js';

function fakeInput(overrides) {
  return {
    up: false, down: false, left: false, right: false, run: false, handbrake: false,
    interactPressed: false, punchPressed: false, pausePressed: false, mutePressed: false,
    ...overrides,
  };
}

function addChaseTraffic(G, cx, cy) {
  // Pack the frame: traffic cars + pedestrians around the chase.
  const defs = ['kancil', 'banteng', 'veloce', 'angkasa'];
  const spots = [
    [cx - 260, cy - 60, Math.PI / 2], [cx + 200, cy + 40, -Math.PI / 2],
    [cx - 80, cy + 240, 0], [cx + 320, cy - 200, Math.PI],
    [cx - 420, cy + 120, Math.PI / 2], [cx + 60, cy - 320, 0],
  ];
  spots.forEach(([x, y, a], i) => {
    const car = spawnVehicle(G.city, defs[i % defs.length], x, y, a, { driver: 'npc' });
    car.lane = { vertical: i % 2 === 0, line: i % 2 === 0 ? x : y, dir: 1 };
    car.cruise = 2.6;
    G.traffic.push(car); G.vehicles.push(car);
  });
  for (let i = 0; i < 8; i++) {
    G.peds.push({
      x: cx - 300 + i * 90, y: cy + 130 + (i % 2) * 40,
      angle: 0, speed: 0.7, shirt: ['#e8e4da', '#4b8fd9', '#d95f4b', '#7a5fd0'][i % 4],
      vertical: false, line: cy + 160, side: 1, dir: i % 2 ? 1 : -1,
      flee: i < 2 ? 120 : 0, angry: i < 2 ? 120 : 0, crossing: i < 3, crossTarget: cy - 160,
      walkPhase: i,
    });
  }
}

export function stageShot(G, name, tickFn) {
  const p = G.player;
  G.screen = 'play';
  G.dialog = null;
  if (name === 'chase') {
    // Mission 6, Heat 3, Mara in the red Veloce S, two interceptors behind.
    startMission(G, 6);
    G.mission.stageIndex = 0;
    const car = spawnVehicle(G.city, 'veloce', 1200, 1200, Math.PI / 2, { driver: 'player' });
    car.speed = 5.2;
    G.vehicles.push(car);
    p.vehicle = car; p.onFoot = false; p.x = 1200; p.y = 1200;
    p.money = 2350; p.rep = 3;
    setHeat(G, 3);
    G.dialog = { lines: ['Dario: Seluruh kota mengejarmu, Mara. Jangan berhenti!'], shown: 0, t: 0 };
    const cop1 = spawnVehicle(G.city, 'interceptor', 1080, 1380, Math.PI / 2, { driver: 'police' });
    const cop2 = spawnVehicle(G.city, 'interceptor', 1330, 1420, Math.PI / 2, { driver: 'police' });
    cop1.speed = 5.6; cop2.speed = 5.4;
    G.police.push(cop1, cop2); G.vehicles.push(cop1, cop2);
    addChaseTraffic(G, 1200, 1200);
    for (let i = 0; i < 90; i++) tickFn(fakeInput({ up: true }));
    setHeat(G, 3); // the cover is a Heat 3 chase, whatever the autopilot hit
  } else if (name === 'street') {
    // Mission 1, Mara on foot in Pasar Tua, green light, busy crossing.
    startMission(G, 1);
    p.x = 1000; p.y = 2520; p.angle = 0; p.onFoot = true; p.vehicle = null;
    p.money = 150; p.rep = 0;
    G.dialog = { lines: ['Dario: Mara! Paket di bengkel, antar ke Pasar Tua.'], shown: 0, t: 0 };
    addChaseTraffic(G, 1000, 2400);
    for (let i = 0; i < 45; i++) tickFn(fakeInput({ up: true }));
  } else if (name === 'canal') {
    // Mission 3, Mara in the Lumba on the canal, Heat 2, bridge raised ahead.
    startMission(G, 3);
    G.mission.stageIndex = 2;
    // Reuse the Lumba already parked at the marina (do not spawn a second boat).
    const boat = G.vehicles.find((v) => v.defId === 'lumba');
    boat.x = 1500; boat.y = 1610; boat.angle = Math.PI / 2;
    boat.driver = 'player'; boat.parked = false; boat.speed = 4.5;
    p.vehicle = boat; p.onFoot = false; p.x = 1500; p.y = 1610;
    p.money = 1250; p.rep = 2;
    setHeat(G, 2);
    G.dialog = { lines: ['Dario: Susuri kanal sampai dermaga timur. Jangan menabrak!'], shown: 0, t: 0 };
    // The interceptor waits on the north bank, east of the bridge — it can
    // be seen, but it cannot drive onto the bridge into the boat.
    const cop = spawnVehicle(G.city, 'interceptor', 2050, 1480, 0, { driver: 'police' });
    G.police.push(cop); G.vehicles.push(cop);
    for (let i = 0; i < 50; i++) tickFn(fakeInput({ up: true }));
    setHeat(G, 2);
  } else {
    // market (default): mission 4, Mara punching the Kessler van driver,
    // Heat 4, a roadblock waiting down the road, van smoking.
    startMission(G, 4);
    G.mission.stageIndex = 1;
    const van = spawnVehicle(G.city, 'angkasa', SPOTS.portGate.x + 100, SPOTS.portGate.y, Math.PI / 2,
      { driver: 'target', color: '#2b2b2b' });
    van.driverHp = 3;
    damageVehicle(van, 60);
    G.missionVan = van; G.vehicles.push(van);
    p.x = SPOTS.portGate.x + 100; p.y = SPOTS.portGate.y + 70; p.angle = 0;
    p.onFoot = true; p.vehicle = null; p.punchAnim = 12;
    p.money = 1900; p.rep = 2;
    setHeat(G, 4);
    G.dialog = { lines: ['Dario: Pukul sopirnya, bawa van-nya, kabur dari polisi!'], shown: 0, t: 0 };
    const cop = spawnVehicle(G.city, 'interceptor', SPOTS.portGate.x - 500, SPOTS.portGate.y, Math.PI / 2, { driver: 'police' });
    cop.speed = 5;
    G.police.push(cop); G.vehicles.push(cop);
    // A roadblock car parked across the road ahead, in the distance.
    const block = spawnVehicle(G.city, 'interceptor', SPOTS.portGate.x + 320, SPOTS.portGate.y - 40, Math.PI / 2, { driver: 'police' });
    block.blocking = true;
    G.police.push(block); G.vehicles.push(block);
    // Angry bystanders + a fleeing pedestrian for the combat read.
    G.peds.push({
      x: p.x + 90, y: p.y - 30, angle: 0, speed: 0.8, shirt: '#d95f4b',
      vertical: true, line: 2600, side: 1, dir: 1, flee: 150, angry: 150,
      crossing: false, walkPhase: 2,
    });
    addChaseTraffic(G, SPOTS.portGate.x, SPOTS.portGate.y);
    for (let i = 0; i < 40; i++) tickFn(fakeInput({}));
  }
  // Frame the shot on the player and let the world settle one more beat.
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  G.cam.x = px; G.cam.y = py;
  G.cam.zoom = name === 'street' ? 1.05 : 0.95;
  for (let i = 0; i < 6; i++) tickFn(fakeInput({}));
  G.cam.x = px; G.cam.y = py;
  // A clean frame: no leftover toast or event flashes from the staging.
  G.toast = null; G.toastT = 0; G.events = [];
  return G.screen;
}
