# Solcayo — Open-World Crime on the Canals

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/tiVan0/solcayo-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/tiVan0/solcayo-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01): build an
open-world crime game. **Solcayo** is a sun-soaked coastal city "where the river meets
the sea" — five districts, a canal, and a story that is 100% original.

## The story

**Mara Voss**, 27, ex-courier fired for being "too fast", now drives for anyone who
pays. Her fixer **Dario Venn** (Venn & Sons garage, Pasar Tua) hands her packages —
one of them is proof of **Kessler Group** corruption, and **Commissioner Ibarra** wants
her caught. Six chained missions take Mara from a first delivery to a city-wide chase
to deliver the evidence to the news office.

## What is in the game

- **Open world, 3200×3200 px, five districts** — Downtown, Barrio Alto, Marina (canal),
  Pasar Tua, Pelabuhan — with long afternoon shadows in one light direction.
- **Walk + drive** — steal any parked car (E), hijack a driven one, drift with the
  handbrake. Five cars + one speedboat, each with its own handling and health.
- **A living city** — 14 traffic cars that obey traffic lights, turn at intersections
  and honk; ~24 pedestrians who cross at zebra crossings and flee from danger.
- **Heat 0–5 + police AI** — patrol, chase, roadblocks with spike strips, and a
  full search at Heat 5. Get caught standing still and it is BUSTED.
- **6 chained missions + side jobs** — taxi fares, a time trial, and 12 Solcayo
  postcards to collect. Mission 3 takes the speedboat down the canal.
- **Full HUD + round minimap** — heat stars, health, money, reputation, city clock,
  mission banner with distance, Dario's phone calls, speed and car condition.
- **Economy** — earn, repair, bribe the heat away at the garage, buy the Veloce S.
- **Save** — autosave after every mission, manual save at the safehouse.
- **Synthesized sound** — WebAudio engine hum, police sirens, jingles. No audio files.

## Play it

```bash
node serve.ts        # then open http://localhost:8080
```

No build step, no dependencies, no network requests — vanilla Canvas 2D.

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk / drive |
| Shift | Run |
| E | Enter / exit car or boat, save at the safehouse |
| Space | Punch (on foot) / handbrake (driving) |
| 1 / 2 / 3 | Garage: repair / bribe heat away / buy Veloce S |
| T / Y | Taxi job / time trial |
| Esc | Pause · M mute |

## Structure

`game/` is plain ES modules, one job per file: `config` (tuning + missions),
`city` (map + collision), `render` (all drawing + HUD + minimap), `player`,
`vehicles` (arcade physics + boat), `traffic`, `pedestrians`, `police`,
`wanted` (Heat), `missions`, `economy`, `audio`, `save`, `shots`
(deterministic `?shot=` scenes), `main` (boot + loop). `main.ts` copies the
game and screenshots into `/output` and writes `dossier.json`.

Screenshots are staged deterministically (`?shot=chase|street|canal|market&seed=20261117`)
from the real game code — never edited or composited.
