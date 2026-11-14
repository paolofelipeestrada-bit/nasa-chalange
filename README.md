# Space Mission Designer

An educational game for the **NASA Space Apps Challenge 2026 — "Space Mission Design Game"**.
Players design a small Earth-observation satellite (a CubeSat) for a real customer need and
learn that every choice costs something somewhere else: mass, power, budget, data, comms and time.

- For anyone aged 10 and up. No prior space knowledge needed: every number has a plain-language
  sentence, a "See the math" box, and glossary tips on the technical words.
- In **English** by default, also in **Português** and **Español** (flag buttons at the top).
- Solo or **cooperative team mode** (2 to 4 players, each one owns some subsystems).

## How to play

Open `index.html` in a browser (double-click works). No install, no build, no login.

The game follows the 6 steps NASA uses to design and develop a science mission, shown as the
arrows at the top of the screen:

| NASA step | In the game |
|---|---|
| 1. Identify Need & Goals | Pick a customer (deforestation, fire scars or urban growth) and read the goals |
| 2. Define Concept | Choose orbit, launcher and ground station |
| 3. Define Requirements | Goals become measurable requirements, each with a way to verify it |
| 4. Design | The Mission Director's cockpit: parts in tabs by crew role (Science, Satellite, Comms), the satellite and its *ripple effect* in the center, the customer's goals and **crew advice** on the right |
| 5. Build & Verify | Every requirement is checked; the four crew members vote **Go / No-Go** from their own goals; **predict** how much data will reach Earth before you launch |
| 6. Implement | Launch and watch the mission in 3D (stages separate, live telemetry, time warp, fullscreen), with random surprises. The ISS is always in orbit; with the Station cargo ride, the cargo ship climbs by Hohmann transfer, docks and the CubeSat is released from the Station |
| Mission Report | Score, why things happened, your prediction vs. the result, a side-by-side comparison with your previous attempt, and **learning cards** (systems-thinking laws after Peter Senge) unlocked by what you just lived |

The 6 resources the challenge asks for are always on screen (the panel stays visible while you
scroll). Hover or focus an option to preview how it would change each resource before choosing.
After each choice, a short "chain of effects" line shows what that choice changed.

Each customer needs a different satellite: every scenario has at least two different winning
designs (checked by an automatic test), so players have to trade off rather than find one answer.

### A living mission with real space weather

In step 6 the player picks a launch date: **March 2019** (quiet Sun) or **March 2024** (solar maximum).
The mission then runs day by day for one year through the space weather NASA actually recorded in that
period (NASA DONKI, stored in `js/data/spaceweather.js`, so it works offline and without an API key):

- Real geomagnetic storms heat and swell the upper air: more drag, the orbit drops faster
  (and faster the lower it gets).
- Real solar particle events can reset the on-board computer and wear the solar panels.
- On-board memory fills with photos and empties during ground-station passes.
- When mission control gets an alert, or memory or power runs short, the mission pauses and the player
  decides; the answer becomes the rule for the rest of the year.

The same design can succeed in 2019 and struggle in 2024. Charts and a mission diary (with links to each
real NASA event) show cause and effect over time.

### Team mode
"Play as a team" at the top. One person creates a room and shares the 6-letter code; the others
join with it. Each player takes a role (Mission manager, Payload scientist, Spacecraft engineer,
Communications and ground) and can only change the choices of that role; the Mission manager moves the
team between phases. The person who created the room is the host and keeps the official game state.
Needs internet (PeerJS public broker, only to introduce the browsers; game data goes directly
between players).

## NASA resources used

- **Design and Develop Science Missions** (NASA, 2025): the 6-step process, the 4 mission segments
  (launch, space, ground, user) and "every requirement comes with a verification".
  https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf
- **CubeSat 101** (NASA CubeSat Launch Initiative): CubeSat sizes, typical 18–24-month schedule,
  budget reserve. https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf
- **Concept Maturity Levels** (NASA JPL): the CML 1–4 tag shown at each step.
- **Build It Yourself: Satellite** (NASA Webb): inspiration for goal-driven design and self-explaining options.
  https://science.nasa.gov/mission/webb/game-build-it-yourself/
- **GMAT — General Mission Analysis Tool** (NASA): reference for the orbital mechanics
  (period, shadow, ground-station contacts). https://software.nasa.gov/software/GSC-19468-1

### Optional NASA data we also use

- **DONKI — Space Weather Database Of Notifications, Knowledge, Information** (NASA CCMC): real storms,
  flares and solar particle events of 2019–2020 and 2024–2025. https://ccmc.gsfc.nasa.gov/DONKI/
- **NASA mission-viz** (web-based space mission visualization): the Earth image in `X3Dom/EarthImage.jpg`
  became a 1° land/ocean/desert/ice map (`js/data/earthmask.js`) that paints the low-poly planet with the
  real continents, so the satellite really photographs the Amazon. Its orbit propagator is our reference
  for drawing orbits. https://github.com/nasa/mission-viz

## What we simplified

Numbers are realistic in order of magnitude but simplified for play: circular orbits, worst-case
shadow, approximate 2026 prices, rough orbital lifetimes. The game teaches trade-offs, not exact
engineering. Every formula is visible in the game under "See the math".

## Use of AI

Our team built this game with help from AI assistants (Claude, by Anthropic) for code and text,
which we reviewed and tested. The game uses no AI-generated images, video or audio, and no NASA logos.

## Open-source libraries

- [Three.js](https://threejs.org/) 0.147 (MIT) — 3D mission view, loaded from a CDN.
  Without internet the game still works, with a timeline instead of the 3D view.
- [PeerJS](https://peerjs.com/) 1.5 (MIT) — team rooms.

## For developers

Plain HTML + JavaScript, no build step and no dependencies to install.

- Tests: open `tests.html` (engine, state, screens, team rules, languages and game balance).
  Data typos also show up there as failed tests.
- Publish: any static host works (for example GitHub Pages from the repository root).

```
index.html            the game
css/style.css         look and feel (colors in variables at the top; light/dark follows the system)
js/i18n/i18n.js       languages: MS.i18n.t('key'), MS.i18n.L({en,pt,es}), setLang('pt')
js/i18n/en|pt|es.js   interface and engine texts (same keys in all three; a test checks it)
js/data/phases.js     the phases: NASA step, segments, concept maturity, help texts
js/data/catalog.js    orbits, launchers, ground stations and components
js/data/scenarios.js  customers (scenarios): need, choices, requirements, verification, events, roles
js/data/glossary.js   glossary terms (tips on dotted words)
js/data/tutorial.js   steps of the optional guided tour (target on screen + text)
js/sim.js             pure engine: MS.sim.run(state) → metrics, checks, requirements, mission, score
js/advice.js          pure crew advice: each role judges the design by its own goal (Go/No-Go),
                      prediction buckets, previous-attempt comparison and learning cards
js/life.js            pure day-by-day mission: altitude, memory, panels, battery + real space weather + decisions
js/data/spaceweather.js  real NASA DONKI events (2019–2020, 2024–2025)
js/state.js           single state + actions + localStorage (MS.store)
js/ui/core.js         header, steps, resource panel, previews, reusable pieces, clicks (data-action)
js/ui/screen*.js      one screen per phase, registered with MS.ui.register(id, screen)
js/viz/looks.js       3D look of each catalog item, derived from its data (pure, tested)
js/viz/parts3d.js     low-poly 3D parts built in code (cards, hangar, mission view)
js/viz/hangar3d.js    3D hangar in the right column: the satellite assembled from the chosen parts
                      (Design) or the rocket on the pad / orbit / ground station (Concept)
js/viz/earth.js       reads the 1° Earth map (pure, tested); data in js/data/earthmask.js
js/viz/schedule.js    3D animation script (pure, tested)
js/viz/orbit.js       Keplerian orbit propagator, after NASA mission-viz's OrbitalPropagator (pure, tested)
                      (also the Hohmann transfer the cargo ship flies to reach the Space Station)
js/viz/mission3d.js   3D mission view (Three.js): staged launch, the player's satellite, flight telemetry,
                      1×/5×/20× time warp, fullscreen and a trajectory colored by orbit status
js/net/team.js        team mode rules: roles and permissions (pure, tested)
js/net/room.js        room by code (PeerJS): the host validates actions and broadcasts the state
js/ui/team-panel.js   team panel and notifications
js/ui/menu.js         start menu (play solo / team / tutorial / how it works) with a light 3D Earth behind it
js/ui/tutorial.js     guided tour: spotlight + bubble over an example design (the player's design is untouched)
js/ui/mission-life.js launch date, decision cards, day-by-day charts and mission diary
js/main.js            connects interface and state
```

Architecture rule: screens only **read** `MS.store.state`, only **change** it through actions,
and compute results with `MS.sim.run(state)`. The state stores choices and progress only;
results are always recomputed. The language belongs to each player and is not part of the state.

### Where to add things

| New thing | Where |
|---|---|
| Text shown in the interface | a key in `js/i18n/en.js`, `pt.js` and `es.js` |
| Text inside the data | `T('english', 'português', 'español')` |
| Component, orbit, launcher, station | `catalog.js` + its id in the slot `options` in `scenarios.js` |
| Requirement | `scenarios.js` → `requirements` (metrics in `MS.sim.metricDefs`) |
| Mission event / random event | `scenarios.js` → `events` / `randomEvents` (drawn from `state.seed`) |
| Customer (scenario) | `variant('id', {...})` in `scenarios.js` (changes only what differs from the base) |
| Help text of a phase | `phases.js` → `guide`, `tips`, `nasa` |
| Glossary term | `glossary.js`; in data texts use `[[key]]` or `[[key\|text]]` |
| Tutorial step | `tutorial.js` → `steps` (`phase`, `target` CSS selector, `title`, `text`); a test checks that every target exists |
| Team role | `scenarios.js` → `team.roles` |
| Crew advice or a learning card | `js/advice.js` (`crew`, `cards`) + texts `crew.*` / `card.*` in the 3 languages |
| 3D look of an item | derived from its data in `js/viz/looks.js`; override with a `look: {...}` field on the catalog item |
| New kind of 3D model | a builder in `BUILDERS` in `js/viz/parts3d.js` + its name in `MS.looks.KINDS` |
| New physics, metric or check type | `sim.js` (`METRICS` + `computeMetrics`, `CHECKS` + `computeChecks`) |

After changing data, run `tests.html`: the validation test points to missing fields or wrong ids,
and the balance test checks that each customer still has at least two winning designs.
