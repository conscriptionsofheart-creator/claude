# README H7: Walk, run, jump and fly gaps, as a pure model

Walk, run, crouch, jump, Fly and the Walk icon (`lkWalkBtn`) are already in the app and are not rebuilt. This part is only what may still be missing, written as a pure model the seat can adopt or ignore. **Check settings for Speed and Gravity first:** whether those rows already exist in Settings is UNCONFIRMED. If they do, use only the model and leave this part's rows out.

Nothing here runs by itself. The page calls `step` each frame while Walk is on. Depends on G0 only. Part name `walk`, needs `core`.

## Files

| File | What it is |
|---|---|
| `gizmo_next_walk.js` | `GizmoNext.WalkModel` (pure) and the `walk` part (scene settings and a Settings page). In `GizmoNext.PARTS`. |
| `gizmo_next_walk_selftest.js` | 17 checks. `node gizmo_next_selftest.js --only=walk`, or the demo page. |
| `gizmo_next_demo.html` | Walk 1 s, Run 1 s, Jump, Fly up 1 s, Speed buttons. |
| `gizmo_next_H7_RAY_SPEC.md`, `wiki_walk-settings.json`, `lesson_walk-settings.md`, `CHANGES_H7.md`, `STAGE_REPORT_H7.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## WalkModel

- `step(state, input, dt, env)` returns a new state `{pos, vel, mode:'walk'|'fly', crouch, camDrop, run, grounded, vignette, speed, dropping}`. Inputs are never changed. Bad numbers are cleaned, `dt` is limited to 0 to 0.1 s.
- Input: `move [strafe, forward]`, `heading` (0 faces -z), `forward3` (head forward, for fly), `vertical` (-1 to 1, second stick or two buttons), `jump` (a press), `run` (held), `runToggle` (a press), `crouch` (held), `setMode`, `seated`.
- Env: `floorAt(x, z)`, `blocked(x, z)` (walk only), `settings`.
- `settings`: Speed 0 to 45 m/s, Gravity 0 to 9.81 (0 floats), Run multiplier 1 to 3, Fly cap 0 to 45, Jump height 0 to 2 m. Defaults 4, 9.81, 1.8, 12, 0.5.
- Fly: up and down with `vertical`, no wall collision, the floor still holds (`floorAt`), speed capped. Fly off drops to the floor under you.
- Crouch lowers the camera by 0.35 m, never the body.
- A seat (`seated: true`) holds you still and returns you to walk mode.
- `vignetteFor(speed, walkSpeed)`: 0 at walk speed, 0.6 at three times, a straight ramp. The state's vignette slews at most 1.5 a second, so 0.025 per frame at 60 Hz and it cannot flicker.

## Part API (`GizmoNext.walk`)

`get()`, `set(patch)` (host only), `stepNow(state, input, dt, env)` (this scene's settings and the page's `floorAt`), `rows(H)`, `state()`, `load()`, `reset()`. Settings are saved with the scene only when they differ from the defaults. A Settings page "Walk settings" lists the rows, the first being "Check settings for Speed and Gravity: these rows may already exist".

## What the local seat does

1. Check Settings for Speed and Gravity rows. If present, skip the Walk settings page.
2. Optionally call `GizmoNext.walk.stepNow` each frame for the vignette, fly and crouch values and feed the result to the rig. Seats pass `seated: true`.
3. Draw the comfort vignette from `state.vignette`.

## Open facts, and the default used

1. Speed and Gravity rows in Settings: unconfirmed, a check row is shown.
2. Meta's Player Speed ceiling 45 m/s and Gravity 9.81 are taken from the stage file.
3. Run multiplier 1.8, fly cap 12, jump 0.5 m are my defaults.
4. The "Carried comfort rules" are not described in the package; only the vignette is built.
5. Quest frame cost is not measured (0.003 ms a step in node).
