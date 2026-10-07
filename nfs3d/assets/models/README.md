# Custom 3D car models (GLB drop-in)

Drop your real car models here and the garage uses them automatically — no code changes.

| File                  | Replaces        |
|-----------------------|-----------------|
| `assets/models/falcon.glb` | FALCON GT  |
| `assets/models/vortex.glb` | VORTEX R   |

Rules the loader applies automatically:
- Any scale works — the model is auto-scaled to 4.4 units long and placed on the floor.
- Name meshes/materials containing `paint`, `body`, `shell` or `chassis` → they receive the player's paint job.
- Name meshes/materials containing `rim` or `wheel` (but not `tire`) → they receive the player's rim colour.
- Keep it under ~150k triangles for smooth frame rate.

To add more cars: add an entry to `CARS` in `nfs3d/main.js` (id, name, klass, price, art, base stats)
and drop `assets/models/<id>.glb` here. Settings → "3D CAR MODELS" tells you which models are live.
