# Car-Game-Repo 🏎️

A car racing game built step by step. Currently in development:
**PAYBACK RUSH** — a 3D, Need-for-Speed-Payback-style street racer (web + three.js).

![2D gameplay screenshot](docs/gameplay.png) *(legacy 2D Highway Dash)*

## 🆕 PAYBACK RUSH (3D) — live in the browser

```bash
cd nfs3d
python -m http.server 8080        # then open http://localhost:8080
```

**Step 1 (done):** high-quality 3D homepage with NEW GAME / CONTINUE /
SETTINGS / EXIT · hub with GARAGE & CAREER · working garage (2 cars —
FALCON GT owned, VORTEX R locked at $12,000) with full specs & upgrade
system (engine / tires / nitro / brakes, 5 stages each) · career with the
first map *Downtown Coast — Sunset Strip Sprint* (reward $1,500) ·
$5,000 starting cash, every race pays out · profile saved locally.

**Next steps:** race gameplay on the map, more cars/maps, sounds.

```
nfs3d/index.html   UI screens (home, hub, garage, career, settings, exit)
nfs3d/style.css    NFS-Payback-style neon UI
nfs3d/main.js      game logic, economy, saves + three.js scene
nfs3d/three.min.js bundled three.js r147
tests/web_smoke.js headless UI flow test (jsdom)
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
- [x] PAYBACK RUSH Step 1: 3D home/hub/garage/career + economy
- [ ] Step 2: playable race on Downtown Coast map
- [ ] More cars & maps
- [ ] Track racing mode (circuit with lap timer)
- [ ] Sound effects & music
- [ ] More cars / cosmetics
