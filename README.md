# Car-Game-Repo 🏎️

A car racing game built step by step. Currently in development:
**PAYBACK RUSH** — a 3D, Need-for-Speed-Payback-style street racer (web + three.js).

![2D gameplay screenshot](docs/gameplay.png) *(legacy 2D Highway Dash)*

## 🆕 PAYBACK RUSH (3D) — live in the browser

```bash
cd nfs3d
python -m http.server 8080        # then open http://localhost:8080
```

**Step 1 (done):** high-quality homepage with NEW GAME / CONTINUE /
SETTINGS / EXIT · hub with GARAGE & CAREER · career with the first map
*Downtown Coast — Sunset Strip Sprint* (reward $1,500) · $5,000 starting
cash, every race pays out · profile saved locally.

**Step 1.5 — 3D garage (done, v0.4 realism):** your GLB cars ship in-game —
**BRUISER V8** and **HYPERION GT** are the free starters (equal rookie pace,
nitrous locked, $5,000 unlock per car) · FALCON GT / VORTEX R are locked
premium purchases · cars stand still on a realistic studio floor and only
rotate in full view (`1` or click) for performance · `◄ ►` switches owned cars ·
specs-only default panel + **CUSTOMIZATION** tab with 12 upgrade categories
(engine … ELITE engine swap at $350,000/stage) · light, natural theme.

**Your 3D cars:** `bruiser.glb` / `hyperion.glb` in `nfs3d/assets/models/`
are the only two cars — auto-scaled, auto-centered, factory-finish aware.
See [`nfs3d/assets/models/README.md`](nfs3d/assets/models/README.md).

**v0.6 — clean garage rebuild (current):** minimal full-bleed 3D garage with a
floating name plate, owned-car chips and a floating panel: SPECS tab shows a
detailed 11-row sheet (engine, power, torque, drivetrain, weight, top speed,
0–100, handling, brakes, nitro, downforce) plus visual bars; CUSTOMIZE tab has
the 12-category upgrade catalog and cosmetic looks. Rendering is light:
on-demand frames, 1.5× pixel-ratio cap, 1024px soft shadows, ACES tone mapping
and a generated studio environment for real paint reflections.

**v1.0 — heavy racing build (current):** RACE 1 with NFS-style feel —
momentum drift (**Space** = handbrake; drifting earns nitro), nitro bursts
(+32% top, flames + FOV kick), speed-reactive camera with shake, body
pitch/roll/drift-angle, tire smoke, drift skree and engine tied to speed.
Controls: **WASD/arrows** drive · **Shift** nitro · **Space** drift · **Esc** pause.

Garage controls: **◄ ► / arrows or chips** switch car · **1 / click** view &
rotate · **Esc** back.

```
nfs3d/index.html        UI screens (home, hub, garage, career, settings, exit)
nfs3d/style.css         premium cinematic UI
nfs3d/main.js           game logic, economy, saves, garage UI
nfs3d/viewer.js         3D garage viewer (sample cars + GLB loader)
nfs3d/audio.js          synthesized sound engine
nfs3d/three.min.js      bundled three.js r147
nfs3d/GLTFLoader.js     GLB/GLTF loader for custom car models
nfs3d/assets/models/    drop your .glb cars here
tests/web_smoke.js      headless UI flow test (jsdom, 46 assertions)
tests/viewer_geometry.js  real-three.js geometry/GLB-normalizer test
```

## Legacy: Highway Dash (2D, pygame)

### Quick start

```bash
pip install -r requirements.txt
python main.py
```

### Live browser preview (no terminal skills needed)

```bash
python web_server.py
```

Then open `http://localhost:8080`. The game runs headless and is streamed to
your browser as live video; drive with your keyboard (arrows/WASD, SPACE to
start) or the on-screen touch buttons.

### Controls

| Key                     | Action              |
| ----------------------- | ------------------- |
| ← / → (or A / D)        | Steer left / right  |
| ↑ (or W)                | Boost               |
| ↓ (or S)                | Brake               |
| SPACE                   | Start / restart     |
| ESC                     | Quit                |

### Gameplay

- Dodge slower traffic on a 4-lane highway; the road speeds up over time.
- Score grows with distance travelled, with a **+25 bonus per car overtaken**.
- Your best score is saved locally in `highscore.json`.

### Project layout

```
main.py            # entry point, game states, loop
game/settings.py   # all tunables (speeds, colors, sizes)
game/sprites.py    # player, traffic cars, scrolling road
requirements.txt
```

### Roadmap

- [x] Highway Dash mode (top-down traffic racer)
- [x] PAYBACK RUSH Step 1: home/hub/garage/career + economy
- [x] Step 1.5: 3D garage viewer (rotate, customization, sound, GLB drop-in)
- [x] v0.4: user GLB starters (BRUISER V8 / HYPERION GT), nitrous lock, realistic light theme
- [x] v0.6: minimal garage rebuild (detailed spec sheets, 2 GLB cars only)
- [ ] Race & map system — awaiting user design
- [ ] More cars & maps
- [ ] Track racing mode (circuit with lap timer)
- [ ] Sound effects & music
- [ ] More cars / cosmetics
