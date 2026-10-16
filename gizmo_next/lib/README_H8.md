# README H8: the Effects gizmo (particles and trail), the last gizmo

One gizmo kind, `effects` (colour `#e86cd2`, up to 12), with a Particles tab (Meta's ParticleFx: Play on Start, Looping, Preset, Preview) and a Trail tab (Meta's TrailFx: Play on Start, Length, Width, Start Color, End Color, Preset Default, Simple, Tapered). Nothing second is built: `particle_flow.js` and the shaders are not touched.

Depends on G0 and H2 (the beat action kind). Part name `effects`, needs `actions`. In `GizmoNext.PARTS`.

## Files

| File | What it is |
|---|---|
| `gizmo_next_effects.js` | The kind, the simulation, the drawing, the beat action `effect`, `flashSafe`. |
| `gizmo_next_effects_selftest.js` | 23 checks. `node gizmo_next_selftest.js --only=effects`, or the demo page. |
| `gizmo_next_three_stub.js`, `gizmo_next_testkit.js`, `gizmo_next_host_TEMPLATE.js` | Stub gains `BufferAttribute`; kit and template gain `hand` and `particleFlow`. |
| `gizmo_next_demo.html` | Add effects gizmo, Play once, Loop, Stop, Preset, Colour; particles drawn as dots on the map. |
| `gizmo_next_H8_RAY_SPEC.md`, `wiki_effects-gizmo.json`, `lesson_effects-gizmo.md`, `CHANGES_H8.md`, `STAGE_REPORT_H8.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## The record

`{tab:'particles'|'trail', preset, looping, playOnStart, length, width, startColor, endColor, size, follow:null|propId|'hand-left'|'hand-right'}` plus the usual `x, y, z, yaw, name, locked, group`. Running state (mode, particles, trail points) is never saved, so a scene opens silent. The only other saved thing is the page budget, when changed.

Presets. Particles: smoke, sparks, confetti, splash. Trail: Default (full width), Simple (half width), Tapered (to a point at the tail).

## API (`GizmoNext.effects`)

- `add(spec)`, `get`, `list`, `setFields(id, patch)`, `kind`.
- `play(id, 'once'|'loop')` (no mode uses the Looping field), `stop(id)`, `preview(id)`, `stopAll()`, `modeOf(id)` (`stop`, `once`, `loop`), `waiting(id)`, `count(id)`, `total()`, `points(id)`, `trail(id)`.
- Play is the host only and only while Gizmos live is on. Preview is her own press and plays once even with live off. A friend's page never starts anything by itself; it mirrors the host's play and stop through the sync message `fx {id, mode}`.
- Play once emits a burst over the preset's window (0.2 to 1.5 s) and ends by itself when the last particle is gone (event `fx {state:'end'}`). A trail in play once runs for 3 s and fades out. Loop runs until Stop.
- Stop clears everything at once (particles, trail, drawing). A stop and a play in the same frame waits two frames before it starts; any restart waits 0.4 s after the last start, so a script cannot strobe an effect.
- Budget: 600 live particles across all gizmos (`budget()`, `setBudget(50..2000)`, saved with the scene). If the page gives `ctx.particleFlow {budget(), used()}`, the effect budget is also limited to what the page has left. Trails keep to 64 points each and 256 in all. Emission is shared out in turn so one gizmo cannot starve the others.
- Safety: a particle fades in over 0.4 s and out over 0.4 s (every preset lives at least 0.8 s), so alpha never changes faster than 2.5 a second; shown colours slew toward her choice at 2.5 a second per channel, so no channel changes faster than that however fast the rows are pressed. `flashSafe(series, hz)` returns false for a brightness series with more than 3 changes (a move of 0.2 or more) in any second.
- `ribbon(points, width, preset, c0, c1, gain)` is the pure strip builder for the trail.
- Rows: Play once, Loop, Stop, Preview, Tab, Preset, Start colour, End colour, Size, (Trail: Length, Width), Follow.
- Beat action `effect {gizmoId, mode: once|loop|stop}`. A Stop on the strip stops loops a beat started.
- Play on Start: runs when Gizmos live is turned on by hand, not when a scene opens (a scene saved live reopens live and stays silent).
- Drawing: one `THREE.Points` per particles gizmo (additive, vertex colours) and one ribbon mesh per trail, in `gizmoNext_effects_layer` on the scene, apart from the box, so Hide gizmos hides the box and the effect keeps playing.

## What the local seat does

1. Add `gizmo_next_effects.js` to `guest_manifest.json` (guests mirror, they never start).
2. `ctx.hand(side)` returning a world `[x, y, z]` for `'left'` or `'right'`, and `ctx.particleFlow` from `particle_flow.js` (`budget`, live count). Check the real names.
3. Wire the Effects tile in Gizmos, the panel rows (`kind.rows`), and `presence`/sync for `fx`.
4. Run the ray spec.

## Open facts, and the default used

1. Meta's preset names beyond Default, Simple and Tapered, and ParticleFx internals, are not confirmed; four particle presets are mine.
2. Particle size is one size per gizmo (a point cloud cannot size each point in three.js r128); smoke does not grow while it rises.
3. Trail ribbon width is horizontal (perpendicular to the path in the ground plane). A camera-facing ribbon is a seat decision.
4. `particle_flow.js` was not read: the page budget is reached only through `ctx.particleFlow`.
5. Quest frame cost is not measured (0.05 ms a frame in node with 12 gizmos at the cap).
