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

**Step 1.5 — 3D garage (done):** live three.js showcase with drag-to-rotate,
scroll zoom and press `1` for full view · `◄ ►` switches between cars you own ·
specs panel (6 bars + perf rating) · **CUSTOMIZATION** tab with 12 upgrade
categories (engine … ELITE engine swap at $150,000/stage) plus paint, rims,
underglow and window tint that apply live to the 3D model · synthesized audio
(engine idle + revs, UI ticks, purchases).

**Drop in your own 3D cars:** put `falcon.glb` / `vortex.glb` in
`nfs3d/assets/models/` — they replace the sample geometry automatically
(auto-scaled, auto-centered, paint/rim aware). See
[`nfs3d/assets/models/README.md`](nfs3d/assets/models/README.md).

**Next steps:** race gameplay on the map, more cars/maps, story mode.

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
- [ ] Step 2: playable race on Downtown Coast map
- [ ] More cars & maps
- [ ] Track racing mode (circuit with lap timer)
- [ ] Sound effects & music
- [ ] More cars / cosmetics
