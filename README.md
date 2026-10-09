# Beer O'Clock 🍺

A countdown to 15:00 set in a small German town, in three.js.

Before 15:00 it rains. Townsfolk walk the square under umbrellas, windows glow,
and the church tower clock counts down. At 15:00 the bell rings, the sky clears,
the rain turns into beer, steins and pretzels pour from the tower, the square
dresses up in Bavarian bunting and everyone jumps around in lederhosen and
dirndls under a big **BEER TIME OKTOBERFEST**.

No build step. three.js is loaded from a pinned CDN through an import map and
the source is plain ES modules in `src/`. Modules do not load over `file://`,
so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## URL parameters

| Param | Effect |
|---|---|
| `?test=10` | Ten second countdown, for demos |
| `?party=1` | Skip straight to the party |
| `?off=a,b` | Disable effects by name: `rain`, `steins`, `explode`, `bloom`, `shadows` |

Click the townsfolk to make them talk. During the party, clicking the ground
spills beer.

## Layout

| File | Role |
|---|---|
| `src/main.js` | boot, renderer, state wiring, frame loop |
| `src/time.js`, `src/state.js` | 15:00 logic and the COUNTDOWN → BLAST → PARTY machine |
| `src/town.js`, `src/clock.js` | procedural houses, church, tower clock, maypole, lamps, Alps |
| `src/people.js` | blocky townsfolk, walking lanes, outfits, beat-synced jumping |
| `src/rain.js`, `src/steins.js` | instanced rain (water → beer) and the mug/pretzel shower |
| `src/text.js`, `src/decor.js` | the extruded headline, bunting, banner, balloons |
| `src/sky.js`, `src/lights.js`, `src/post.js`, `src/camera.js` | weather blend, lighting, bloom, camera rig |

## Deploying

`.github/workflows/pages.yml` publishes the repo root on every push to `main`.
The repository's Pages source must be set to **GitHub Actions**.
