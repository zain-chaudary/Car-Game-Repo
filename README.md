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

**Drop in your own 3D cars:** put `falcon.glb` / `vortex.glb` in
`nfs3d/assets/models/` — they replace the sample geometry automatically
(auto-scaled, auto-centered, paint/rim aware). See
[`nfs3d/assets/models/README.md`](nfs3d/assets/models/README.md).

**Step 2 — playable race (done):** *Sunset Strip Sprint* on **Downtown Coast** —
2.4 km coastal sprint vs two AI cars (rubber-banded), 3-2-1-GO countdown,
chase camera, HUD (speed / position / time / nitro / progress), rail-stable
arcade physics (WASD/arrows, Shift = nitro when unlocked, Esc = pause).
P1 pays $1,500, finishing pays $500. World is instanced (one draw call per
group): ocean, promenade, buildings, palms, light poles, rails, gantries.

Controls: **WASD / arrows** drive · **Shift** nitro · **Esc** pause.

**Next steps:** more races/maps, story mode, drift/handling model.

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
- [x] Step 2: playable race on Downtown Coast (AI opponents, nitro, payouts)
- [ ] More cars & maps
- [ ] Track racing mode (circuit with lap timer)
- [ ] Sound effects & music
- [ ] More cars / cosmetics
