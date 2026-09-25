# Beer O'Clock 🦁🍺

A single-file countdown to 15:00, set in a jungle full of lions, bears, monkeys
and other animals having a great time. At 15:00 the can explodes, the sun turns
into a disco ball, beer cans rain from the sky and everyone gets a party hat.

No build step, no dependencies. Open `index.html` in a browser.

## URL parameters

| Param | Effect |
|---|---|
| `?test=10` | Ten second countdown, for demos |
| `?party=1` | Skip straight to the party |

Click the animals to make them talk. Click the can to shake it.

## Deploying

`.github/workflows/pages.yml` publishes the repo root on every push to `main`.
The repository's Pages source must be set to **GitHub Actions**.
