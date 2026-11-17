// Solcayo — all tuning numbers, palette, districts, vehicles and missions.
// One place for every magic number so the rest of the code reads like a design doc.
export const WORLD = 3200;            // world is WORLD x WORLD px, 8x8 road blocks
export const ROAD_STEP = 400;         // distance between road centre lines
export const ROAD_HALF = 36;          // half width of a road (asphalt)
export const WALK_HALF = 54;          // sidewalk outer edge from road centre
export const CANAL_Y0 = 1560;         // canal water band (horizontal, across the map)
export const CANAL_Y1 = 1660;
export const CANAL_X0 = 200;
export const CANAL_X1 = 3200;
export const BRIDGES = [800, 1600, 2400]; // road x positions with a bridge over the canal
export const STEP = 1 / 60;           // fixed timestep

export const PALETTE = {
  skyTop: '#ffd9a0', skyBot: '#7ec8e3',
  grass: '#8fce7e', grassAlt: '#7cc06f', sand: '#e8d5a8',
  road: '#3a3f4a', roadLine: '#e8d27a', sidewalk: '#c9b8a3',
  water: '#3d9db5', waterDeep: '#2b7d94', wave: '#bfe8f2',
  buildingGlass: '#7fb2d9', buildingBrick: '#e8a87c', buildingCream: '#f2d492',
  buildingRoof: '#5d6b7a', containerA: '#d95f4b', containerB: '#4b8fd9', containerC: '#e8b23a',
  tree: '#3f7d44', palm: '#5da271', trunk: '#8a6b4f',
  hudBg: 'rgba(12,18,28,0.72)', hudText: '#ffffff', hudGold: '#ffd94d',
  heat: '#ff5a3c', policeBlue: '#2f6df6', policeRed: '#ff3b30',
  waypoint: '#ffd94d', playerArrow: '#ffffff',
};

export const DISTRICTS = [
  { name: 'Downtown', x0: 0, y0: 0, x1: 1600, y1: 1400, tint: '#7fb2d9' },
  { name: 'Barrio Alto', x0: 1600, y0: 0, x1: 3200, y1: 1400, tint: '#f2d492' },
  { name: 'Marina', x0: 0, y0: 1400, x1: 3200, y1: 1800, tint: '#3d9db5' },
  { name: 'Pasar Tua', x0: 0, y0: 1800, x1: 1600, y1: 3200, tint: '#e8a87c' },
  { name: 'Pelabuhan', x0: 1600, y0: 1800, x1: 3200, y1: 3200, tint: '#8a94a6' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solcayo';
}

// Spots the story uses (all inside blocks, next to a road).
export const SPOTS = {
  safehouse: { x: 360, y: 360, label: 'Safehouse Mara' },
  garage: { x: 560, y: 2440, label: 'Venn & Sons — Bengkel Dario' },
  policeStation: { x: 1000, y: 300, label: 'Kantor Polisi Kota' },
  newsOffice: { x: 1800, y: 760, label: 'Kantor Berita Solcayo' },
  marinaDock: { x: 1600, y: 1500, label: 'Dermaga Marina' },
  boatSpawn: { x: 1600, y: 1610, label: 'Speedboat Lumba' },
  market: { x: 1000, y: 2440, label: 'Pasar Tua' },
  portGate: { x: 2600, y: 2400, label: 'Gerbang Kessler' },
  meetingPoint: { x: 2200, y: 2400, label: 'Titik Pertemuan' },
  plaza: { x: 1200, y: 1200, label: 'Plaza Downtown' },
};

export const VEHICLES = {
  kancil:      { name: 'Kancil',      kind: 'car',  color: '#e8b23a', accel: 0.24, top: 5.4, turn: 0.058, hp: 70,  price: 0,    w: 34, l: 52 },
  veloce:      { name: 'Veloce S',    kind: 'car',  color: '#c0392b', accel: 0.32, top: 7.6, turn: 0.062, hp: 85,  price: 3000, w: 36, l: 56 },
  banteng:     { name: 'Banteng Pickup', kind: 'car', color: '#3f7d44', accel: 0.22, top: 5.9, turn: 0.046, hp: 130, price: 1800, w: 38, l: 62 },
  angkasa:     { name: 'Angkasa Van', kind: 'car',  color: '#e8e4da', accel: 0.18, top: 5.1, turn: 0.040, hp: 150, price: 2200, w: 40, l: 68 },
  interceptor: { name: 'Interceptor Polisi', kind: 'car', color: '#f2f2f2', accel: 0.34, top: 8.2, turn: 0.064, hp: 110, price: 0, w: 36, l: 58 },
  lumba:       { name: 'Lumba',       kind: 'boat', color: '#2fb3c9', accel: 0.26, top: 6.8, turn: 0.05,  hp: 90,  price: 0,    w: 30, l: 64 },
};

export const TUNING = {
  walkSpeed: 2.6, runSpeed: 4.4, punchRange: 46, punchDamage: 1, punchCooldown: 22,
  playerHealth: 100, healthRegen: 0.02,
  heatDecayHiddenSeconds: 8, heatDecayStepSeconds: 8,
  bribePerHeat: 200, bustedFine: 150, wastedFee: 100,
  policeChaseSpeed: 7.4, policeSpawnDistance: 700, maxPolice: 6,
  trafficCount: 14, pedCount: 24, postcardCount: 12,
  taxiFareMin: 150, taxiFareMax: 400, timeTrialReward: 300, postcardReward: 50,
  postcardBonus: 500, saveKey: 'solcayo.save.v1',
};

export const MISSIONS = [
  {
    id: 1, name: 'Paket Pertama', reward: 300, rep: 1,
    dialog: ['Dario: Mara! Paket di bengkel, antar ke Pasar Tua.', 'Jangan dibuka. Jangan ditanya. Jangan telat.'],
    stages: [
      { kind: 'goto', x: SPOTS.garage.x, y: SPOTS.garage.y, r: 90, label: 'Temui Dario di bengkel' },
      { kind: 'enterCar', label: 'Curi sedan parkir di depan bengkel (E)' },
      { kind: 'driveTo', x: SPOTS.market.x, y: SPOTS.market.y, r: 90, label: 'Antar paket ke Pasar Tua' },
    ],
  },
  {
    id: 2, name: 'Antar Kilat', reward: 500, rep: 1,
    dialog: ['Dario: Paket kilat ke Marina. 90 detik, Mara.', 'Lampu merah itu saran, bukan perintah.'],
    stages: [
      { kind: 'timed', x: SPOTS.marinaDock.x, y: SPOTS.marinaDock.y, r: 90, seconds: 90, label: 'Antar paket ke Marina — 90 detik!' },
    ],
  },
  {
    id: 3, name: 'Lampu Kanal', reward: 800, rep: 1,
    dialog: ['Dario: Polisi menutup jalan. Lewat kanal saja.', 'Speedboat Lumba menunggumu di dermaga.'],
    stages: [
      { kind: 'goto', x: SPOTS.marinaDock.x, y: SPOTS.marinaDock.y, r: 90, label: 'Ke dermaga Marina' },
      { kind: 'enterBoat', label: 'Naik speedboat Lumba (E)' },
      { kind: 'boatTo', x: 2800, y: 1610, r: 100, label: 'Susuri kanal ke dermaga timur' },
    ],
  },
  {
    id: 4, name: 'Tagihan Kessler', reward: 1200, rep: 1,
    dialog: ['Dario: Van Kessler bawa uang kotor. Rampas!', 'Pukul sopirnya, bawa van-nya, kabur dari polisi.'],
    stages: [
      { kind: 'goto', x: SPOTS.portGate.x, y: SPOTS.portGate.y, r: 120, label: 'Ke gerbang Pelabuhan Kessler' },
      { kind: 'punchDriver', label: 'Pukul sopir van Kessler sampai kabur (Space)' },
      { kind: 'enterVan', label: 'Naik van Kessler (E)' },
      { kind: 'escape', x: SPOTS.garage.x, y: SPOTS.garage.y, r: 110, heat: 3, label: 'Kabur dari polisi — kembali ke bengkel!' },
    ],
  },
  {
    id: 5, name: 'Saksi Mata', reward: 1500, rep: 1,
    dialog: ['Dario: Ikuti mobil Kessler. Jangan ketahuan.', 'Jaga jarak. Foto titik pertemuannya.'],
    stages: [
      { kind: 'tail', seconds: 22, label: 'Ikuti mobil Kessler — jangan terlalu dekat!' },
      { kind: 'photo', x: SPOTS.meetingPoint.x, y: SPOTS.meetingPoint.y, r: 100, label: 'Foto titik pertemuan (otomatis)' },
      { kind: 'escape', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, r: 110, heat: 2, label: 'Kabur ke safehouse!' },
    ],
  },
  {
    id: 6, name: 'Jalan Pulang Panjang', reward: 2500, rep: 2,
    dialog: ['Dario: Bukti korupsi Kessler ada di tanganmu.', 'Antar ke kantor berita. Seluruh kota akan mengejarmu.'],
    stages: [
      { kind: 'checkpoint', x: 1200, y: 2000, r: 100, heat: 5, label: 'Checkpoint 1/3 — lewati Pasar Tua' },
      { kind: 'checkpoint', x: 2000, y: 1200, r: 100, heat: 5, label: 'Checkpoint 2/3 — lewati Downtown' },
      { kind: 'checkpoint', x: SPOTS.newsOffice.x, y: SPOTS.newsOffice.y, r: 110, heat: 5, label: 'Checkpoint 3/3 — kantor berita!' },
      { kind: 'escape', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, r: 110, heat: 5, label: 'Lolos ke safehouse — selesai!' },
    ],
  },
];

export const POSTCARD_SPOTS = [
  [300, 700], [700, 300], [1100, 700], [1500, 300], [2100, 700], [2500, 300],
  [300, 2100], [700, 2900], [1100, 2100], [1500, 2900], [2100, 2100], [2500, 2900],
];

export const INTRO_LINES = [
  'Solcayo — kota di mana sungai bertemu laut.',
  'Mara Voss, 27, mantan kurir paket. Kini sopir lepas untuk siapa pun yang membayar.',
];
