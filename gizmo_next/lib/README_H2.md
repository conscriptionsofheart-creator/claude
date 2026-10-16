# README H2: actions on beats

Beats carry more than poses. This stage adds the action registry on `g.modules.beats.actions` (also `GizmoNext.actions`): a recorded voice (`say`), partial looks (shader, clothes, eyes, skin), `face`, `sound`, `ragdoll`, `seat`, `script`, `camera`, hold lengths, and the flash clamp. `move` (props) came with H1.

Nothing runs when a scene opens. An action starts only when the clock passes its beat going forward while someone has pressed Play. A load starts nothing. A friend's page starts no action at all.

Depends on H1 (`gizmo_next_beats.js`) and G0. Part name `actions`, needs `beats`.

## Files

| File | What it is |
|---|---|
| `gizmo_next_actions.js` | The registry, the built in kinds, the clamp, the rows and the 2D buttons. Added to `GizmoNext.PARTS` in the core. |
| `gizmo_next_actions_selftest.js` | 21 checks. `node gizmo_next_selftest.js --only=actions`, or the demo page. |
| `gizmo_next_beats.js` | Extended for this stage (see below). The H1 checks still pass. |
| `gizmo_next_demo.html` | Now has a fake voice and sound: Add voice beat, Add shader beat. |
| `gizmo_next_H2_RAY_SPEC.md`, `wiki_beat-actions.json`, `lesson_beat-actions.md`, `CHANGES_H2.md`, `STAGE_REPORT_H2.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## Public API

- `actions.register(kind, {validate(pin, env), start(pin, env), update?(pin, env, dt), stop?(pin, env), hold?(pin, env), looks?})`. `validate` returns the cleaned pin, or a plain sentence (the beat is refused and the sentence is shown). `start` returns `{keep:true}` to stay active until Stop. `looks:true` makes the kind count in the flash clamp (H8 uses this for effect colours). Also `get`, `kinds`, `isKnown`.
- Built in kinds and the adapters they call:
  - `say {slot, rec}`: `ctx.narration.play(slot, rec)`; hold is the recording's seconds from `ctx.narration.voLines(slot)` (`[{rec, seconds}]`), editable; `actions.mouth(slot)` reads `ctx.narration.mouth(slot)`. Plays once for each pass (a looping clock plays it again when the loop restarts).
  - `look` (H1's pin, now with partial parts): only the parts present are changed. The shader, clothes, eyes and skin are each their own timeline, so a wave beat never resets her outfit. Clothes are checked against `ctx.look.allowedClothes()`; a piece not in it is left out with a plain message, and with no list connected all clothes are left out.
  - `face {slot, expression}`: `ctx.face.apply(slot, expression)`. Absent: one plain message each Play.
  - `sound {gizmoId, mode:'once'|'loop'|'stop'}`: `ctx.sounds.playMode(gizmoId, mode)`.
  - `ragdoll {slot, clipId}`: `ctx.clips.play(slot, clipId)`, `ctx.clips.stop(slot)`.
  - `seat {slot, seatId|'stand'}`: `ctx.seat.sit(slot, seatId)`, `ctx.seat.stand(slot)`.
  - `script {name, objKind?, objId?}`: `ctx.scripts.event(kind, id, 'beat', name)`.
  - `camera {shot}`: `ctx.camera.shot(name)`.
- `actions.clamp(beats)` returns `{beats, changed, messages[]}` and is pure. Look-changing beats keep 0.4 s between distinct times and at most 3 start in any second. Later ones are moved later, never earlier. A second run changes nothing. Messages are plain: "Two look changes were spread out so nothing flashes."
- `actions.sanitize(beats)` drops beats of an unknown kind or without a time, and never throws.
- Adding: `actions.addSay(slot, rec, t?)` (the hold is the recording's length, and the clock moves on past it so the next beat waits), `actions.addLook(slot, parts, t?)` (`parts` is a list of part names taken from the figure now, or an object; unchanged parts are skipped), `actions.add({kind, slot, ...fields})` for the rest. Each makes one Undo step.
- Stopping: Stop and Pause call every active `stop` (the voice is stopped, a looping sound is stopped). Resume does not start things that already started.
- Rows (headset): after the strip's own rows, Add voice for each recording of the selected figure (6 at most), Add shader beat, Add clothes beat, Add eyes beat, Add skin beat, and with a card selected Hold longer and Hold shorter by 0.5 s. The 2D panel gets the same as buttons. A friend's page gets neither.

## What changed in `gizmo_next_beats.js`

`hooks.pin[kind]` (clean one pin), `hooks.list[i]` (clean the whole list), `hooks.rows[i]`, `onPause`, `setClock(t)`, per part look timelines (before a part's first beat it is left alone), and the clock length now counts the hold of every kind. The look change spacing rule is applied twice, by the beats part and by the clamp, and they agree.

## SEAT EDITS (this stage)

In `lib/gizmo_next_host.js`: `ctx.narration {voLines, play, stop, mouth}` over `narration.js` (voToggle, voIngest, speakerOf, play, the jaw drive), `ctx.look.allowedClothes()` from `wardrobe_cleared.json`, `ctx.face.apply`, `ctx.sounds.playMode`, `ctx.clips`, `ctx.seat`, `ctx.scripts.event`, `ctx.camera.shot`. Each is optional. The shapes above are what the code calls; where the real function is named differently, adapt it in the host file, not here. Icons for the new rows: `voice`, `look`. Add `gizmo_next_actions.js` to `guest_manifest.json`.

## Cost

`actions_tick_cost_ms_per_tick` about 0.01 ms with 12 beats, 6 looping sounds, a voice and a script beat playing. With nothing active the actions tick returns at once.

## Open facts, and the default used

1. **Names of the adapters.** The package showed only the narration excerpt, so the adapter shapes above are mine. The behaviour is tested against fakes with exactly these shapes.
2. **Clothes list.** `wardrobe_cleared.json` is not in the package. With no `allowedClothes()` all clothes are refused, the safe default.
3. **Shader ids** are not checked (any short name is accepted). A shader name cannot blend, so it switches at the middle of the blend while numbers (colour, amount) blend smoothly over at least 0.4 s.
4. **A face part inside `bodyLook`** is unconfirmed. `face` goes through `ctx.face` and does nothing without it.
5. **A friend hearing a voice** is not solved here (H9). The host plays voices and sounds; a friend's page starts none.
6. **Ragdoll and seat** adapters stay quiet until H4 and H6 supply them.
