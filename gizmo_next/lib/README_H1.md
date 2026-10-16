# README H1: the scene clock and the Beat strip

One timeline, not a second one. A beat is all the pins at one time. The list has the CastPins shape, so `direction.js` and `_castSaveState` can read it, but its clock is its own scene clock when no song plays. Old keyframes (`window.__kf`) stay readable and turn into beats on request.

Nothing runs when a scene opens. A scene opens stopped. A load applies nothing and starts nothing. The clock only moves after a person presses Play.

Depends on G0 (`gizmo_next_core.js`). It is a part: `GizmoNext.register('beats', ...)`. The page reaches it as `GizmoNext.beats` (or `g.modules.beats`).

## Files

| File | What it is |
|---|---|
| `gizmo_next_beats.js` | The engine, the future `lib/beats.js`. Add it to `GizmoNext.PARTS` (done in the core), guest manifest included. |
| `gizmo_next_beats_selftest.js` | 31 checks. Runs with `node gizmo_next_selftest.js --only=beats`, or the demo page. |
| `gizmo_next_demo.html` | Now also has two fake figures and the Beat strip. Opens from a file. |
| `gizmo_next_H1_RAY_SPEC.md` | The real-ray test for the local seat. |
| `wiki_beats.json`, `lesson_beats.md`, `CHANGES_H1.md`, `STAGE_REPORT_H1.md` | Wiki card and change row, lesson draft, change note, report. |

## How it works

- **Pins.** `pins()` returns `[{id,t,slot,kind,pose|look|transform,hold?,...}]`. Kinds sampled in H1: `pose`, `hand`, `look`, `move` (a prop: `{propId, transform:{p,r,s}}`, `slot` is `prop:<id>`). Any other kind (`say`, `sound`, `ragdoll` and so on, added by H2) is kept, saved and shown on the strip, and handed to listeners when the clock passes it. `pinsSet(arr)` replaces the list after cleaning it (at most 300 pins, times 0 to 86400 s, strings cut, dangerous keys dropped).
- **Pure sampling.** `stateAt(t)` is computed from the list and `t` only. Smootherstep blends between neighbouring pins of the same figure and kind. Before the first pin the first pin holds, after the last the last holds. A pin's `hold` keeps the figure still for that long before the blend starts. Same `t`, same state: playing to `t`, scrubbing to `t` and a friend joining at `t` land identically.
- **Clock.** `clock.t`, `length`, `playing`, `state` ('stopped', 'paused', 'playing'), `mode` ('once', 'loop', 'yoyo'), `bracket` (`{a,b}` or null), `speed`, `gap`. `play(fromT?)`, `pause()`, `stop()` (every figure and prop goes back to the state it had when playing began), `scrub(t)`, `setSpeed`, `setMode`, `setBracket(a,b)`, `clearBracket()`, `setGap`. `time()` is `ctx.songTime()` while a song plays, else `clock.t`. With a song playing, Play slaves the beats to the song's time.
- **Add beat.** `addBeatNow(slots?, {look?})` captures `ctx.pose.get(slot)` (and `ctx.look.get(slot)` with `look:true`, and the transform of `prop:<id>` slots), refuses what has not changed since the state the clock would show now, puts the beat at `clock.t`, then moves the clock on by `gap` (default 1.0 s). With no slots it uses `ctx.selectedSlots()`, else every figure. One `pushUndo()` for the press.
- **Edit.** `add`, `remove`, `removeBeat`, `retime`, `retimeBeat` (a whole card), `setHold`, `list`, `get`, `convertKeyframes(frames, gap=1.0)`. Frames may be `{poses:{slot:pose}}`, `{bodies:[{slot,pose}]}` or `[{slot,pose}]`. The frames are never changed.
- **No flashing.** Look changes keep at least 0.4 s between distinct times, so at most 2.5 a second. A look beat that is too close is moved later and the toast says so. A look blend never runs shorter than 0.4 s (a long `hold` is cut to leave room).
- **Strip.** `strip.model()` gives one card for each beat time: `{id, ids, t, slot, slots, thumbKey:'slot:<slot>', icons:[...], hold, selected}`. `strip.rows(H)` gives the headset rows (Add beat, Add beat with look, Play or Pause, Stop, Loop mode, Gap, Speed, Bracket start and end, Clear the bracket, then for a selected card Play from here, Move earlier, Move later, Delete this beat, then one row for each card, 24 at most). `strip.select(id)`. `mountPanel(el)` builds the 2D Animate panel (buttons, a scrub slider, the cards). Tile size is the host's job, at least 2.0 cm.
- **Page.** Registers `{id:'beats', where:'animate'}`, tile text "Beat strip", so `GizmoNext.pages('animate')` lists it.
- **Events.** On the bus: `beat-play`, `beat-stop`, `beat-end`, `beat-change`. For later stages: `beats.onPass(fn(pins, info))` (called once each time the clock passes an event pin going forward, once for each loop, not on scrub, and only on the forward leg of a Yoyo) and `beats.onStop(fn)`.
- **Friends.** The host decides. A guest cannot add, delete, move, play, pause, stop or scrub, and gets rows and a panel with no buttons. The list itself travels on the page's existing `pins` message (the guest calls `pinsSet`). The core's `beats` sync part carries only the transport `{st, t, speed, mode, br, h, n}`, at most 10 messages a second, sent again every 2 s while playing and retried for 3 s if the limit dropped one. `h` is a fingerprint of the list: if it differs the guest waits and logs why, instead of playing something else. Private projects send nothing.
- **Saving.** `state()` and `load()` are called by the core's own save (`parts.beats`). A load stops the clock and applies nothing.

## SEAT EDITS (this stage)

1. In `lib/gizmo_next_host.js` (the template has the lines): `ctx.pose {get(slot), apply(slot, pose, k, tag?)}` and `ctx.look {get(slot), apply(slot, parts, k)}` through `snapshotObj` and `bodyLook`/`applyLook`; `ctx.songTime()` (the song's time while a song plays, else null); `ctx.selectedSlots()`; optional `ctx.pose.blend(a, b, k)` (the default blends numbers and number lists one by one, which is wrong for quaternions); optional `ctx.moveProp(id, {p,r,s})` (the default writes `position`, `rotation`, `scale` of the object from `ctx.props()`). The `hand` kind is applied as `pose.apply(slot, hand, 1, 'hand')`.
2. In `couple3d.html`: swap `SCENE_PINS` for `GizmoNext.beats.pins()` (read) and `GizmoNext.beats.pinsSet(arr)` (write, for the friend path), and the `_songT()` fallback for `GizmoNext.beats.time()`. Leave saving the beats to `GizmoNext.state()` (it already holds `parts.beats`), or feed `pins()` into `_castSaveState` and stop there, not both.
3. The Animate page tile (E11): list `GizmoNext.pages('animate')`, draw `GizmoNext.pageRows('beats', H)`. In the 2D panel call `GizmoNext.mountPanel(el)`, which now includes the Beat strip.
4. Icons in `bsa_icons.js`: card icons `pose`, `hand`, `look`, `move` (reserved for H2 and later: `voice`, `face`, `sound`, `ragdoll`, `seat`, `script`, `camera`, `effect`); row icons `plus`, `play`, `pause`, `stop`, `loop`, `clock`, `left`, `right`, `trash`. A missing name just draws no icon.
5. The page's Undo snapshot must include `GizmoNext.state()` (edit G0-3), otherwise Add beat is recorded but not undone.
6. Add `gizmo_next_beats.js` to `guest_manifest.json`. It has no export, save or download.

## Cost

`beats_tick_cost_ms_per_tick`: about 0.02 ms for each tick with 48 pins (12 beats, 4 figures) playing in Loop, on the stub. While stopped or paused the tick does nothing.

## Tests: 31/31 here, 75/75 with G0

See `CHANGES_H1.md` for the names. The demo page was driven in headless Chromium: hand up, right, left, Add beat each time, an unchanged pose refused, Play, the wrist read about 0.34 at 1.2 s, ended at -0.4, Stop put it back, and the in-page selftest read 75/75 with no console error and no outside request.

## Open facts, and the default used

1. **Play with Gizmos live off.** Play is a direct press, so the clock ticks while it plays even with Gizmos live off (`alwaysTick`). Stopped or paused, it does nothing. If Gizmos live should also gate Play, remove `api.alwaysTick = true`.
2. **Shape of a pose and a look.** Not shown in the package. They are handled as plain data and blended number by number.
3. **Shape of `__kf` frames.** Three shapes accepted (see Edit). Say which the page really has.
4. **Slot type.** A slot stays as given (a number or a string) and goes back unchanged into `ctx.pose.get`.
5. **Loop.** It jumps from the last beat to the first. Add a closing copy of the first beat for a smooth loop, or use Yoyo.
6. **Atelier creatures as beats.** No (the stage file's default).
7. **Quest frame cost of the strip.** Not measured.
