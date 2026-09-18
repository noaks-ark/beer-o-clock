# Beer O'Clock

A WebGL countdown to 15:00. Extruded 3D numerals glow on a synthwave grid while
beer cans drift by. At 15:00 the timer collapses, "BEER TIME" pops in, the cans
explode and rain down, and the lights, bloom and camera go to the club.

Built with [three.js](https://threejs.org) and Vite. No framework, no assets
beyond one typeface file.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve dist/
```

## URL parameters

| Param | Effect |
|---|---|
| `?test=10` | Ten second countdown, for demos |
| `?party=1` | Skip straight to the party |
| `?off=after,rgb,strobe` | Disable named effects, for tuning. Names: `after`, `rgb`, `glitch`, `strobe`, `explode`, `rain`, `pulse`, `whip`, `hue`, `orbit`, `spot`, `party`, `env`, `floor`, `cans`, `bloom` |

Beer time is 15:00 in the browser's local time. Once it has passed, the page
stays in party mode until it is reloaded the next day. `prefers-reduced-motion`
turns off the spin, strobe, glitch, trails and camera shake.

## How it is put together

```
src/
  main.js     renderer, scene, boot, frame loop, resize
  time.js     target time, URL params, HH:MM:SS formatting
  state.js    countdown -> blast -> party
  text.js     3D digits (pre-built glyph atlas) and BEER TIME, with the motion
  cans.js     procedural cans in one InstancedMesh, with simple physics
  lights.js   orbiting, strobing point lights
  floor.js    grid shader, fog and background
  post.js     bloom, afterimage, RGB shift, glitch, film, output
  camera.js   orbit, dolly, shake, fit-to-viewport
  beat.js     128 BPM clock everything syncs to
  overlay.js  the DOM captions
```

## Deploying to GitHub Pages

`.github/workflows/pages.yml` builds `dist/` and deploys it on every push to
`main`. For it to work, set the repository's Pages source to **GitHub Actions**
(Settings → Pages → Build and deployment → Source). The Vite base is `./`, so
the site works from any sub-path.
