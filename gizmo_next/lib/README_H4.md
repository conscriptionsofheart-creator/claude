# README H4: record a rag doll fall, play it back

Record the RESULT of a fall, not the simulation. While Gravity is on, Record fall samples the doll's joint turns and its hips every 1/30 s into a clip. Playing it goes through the page's clip player, so there is no physics at playback, a friend sees the same fall, and the cost is small. A `ragdoll` beat (H2) plays a clip by its id.

Nothing runs on open. Loading a scene lists the saved falls and plays none. A fall records only after a person presses Record fall. A friend's page cannot record.

Depends on H1 and H2 (the beat action). Part name `ragdoll`, needs `actions`. It replaces H2's placeholder `ragdoll` action with one that knows the recorded clips.

## Files

| File | What it is |
|---|---|
| `gizmo_next_ragdoll.js` | Recorder, clip store, player glue, audit, the `ragdoll` beat action, strip rows, 2D buttons. In `GizmoNext.PARTS`. |
| `gizmo_next_ragdoll_selftest.js` | 17 checks. The falls are made up by a small formula, no outside motion data. `node gizmo_next_selftest.js --only=ragdoll`, or the demo page. |
| `gizmo_next_demo.html` | Record a fall (3 s), Play last fall, Stop the fall, with a made-up fall. |
| `gizmo_next_H4_RAY_SPEC.md`, `wiki_ragdoll-record.json`, `lesson_ragdoll-record.md`, `CHANGES_H4.md`, `STAGE_REPORT_H4.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## API (`GizmoNext.ragdoll`)

- `record(slot?)`: starts sampling `ctx.ragdoll.joints(slot)` every 1/30 s of `ctx.now()` (a slow frame is filled by blending, so the clip is always 30 frames a second). Refused with a plain message when the figure is not falling (`isFalling`), when it is a friend's page, when the doll is not connected, or when 24 falls are already kept. One Undo step.
- `stop()` returns the clip id, or null with a plain message ("That fall is too long, shorten it." above 1 MB or 150 s, or too short). Never a silent cut.
- `clips()` (`{id, name, frames, seconds, bytes, joints, here}`), `get(id)`, `seconds(id)`, `rename`, `remove(id)`, `undoLast()` (removes the last recording and its saved file).
- `play(slot, id, {from?, speed?})`: hands the clip to `ctx.clips.play(slot, clip, {loop:false, speed})`, then `setTime(from)`. The doll stays in its last frame until Stop. `stopPlay(slot)` calls `ctx.clips.stop(slot)` (the player puts the poses back). `isPlaying(slot)`.
- `toClip(id)`: the clip in clip_player's own format `{fps:30, frames:[{q:[22 slots], root:[x,y,z]}], hip0}`. Slot 0 is the hips' turn, 1 to 21 are body joints the doll reports, the rest stay empty so the player leaves the body's own hands and face. The hips are kept at least 5 cm above the floor.
- `audit(id)`: `{kneeMinDeg, rootMinY, samples, seconds}` read at 60 Hz with the turns blended the way the player blends them. A knee below about minus 1 degree bends backwards.
- `files()` and `restoreFiles(map)`: the saved scene carries the clips by name (`ragdoll_<id>`), so a scene saver can ship them.
- Beat action `ragdoll {slot, clipId}`: plays once for each pass, its hold is the clip's length (so the next beat waits), Stop and Pause stop it.

## How a clip is kept

Quaternions and the hips' place are 16 bit whole numbers in base64 text: turns scaled by 16383 (under 0.01 degree of error, measured 0.0045), the hips' place in millimetres from the first frame. About 7 KB a second for 20 joints (10 s measured 70 KB, limit 100 KB). It is saved under its own storage key `jb_gizmonext_file_ragdoll_<id>` and the scene state lists only `{id, name, frames, seconds, bytes, joints}`. Under 1 MB each, 24 at most.

## SEAT EDITS (this stage)

1. H4-1: expose a read function in RAGP and give it to the host file as `ctx.ragdoll = {joints(slot), isFalling(slot), map?}`. `joints(slot)` returns `{root:{p:[x,y,z], q:[x,y,z,w]}, q:{<clip joint index 1 to 21>:[x,y,z,w]}}` in world metres, or `q` as a list in RAGP order with `ctx.ragdoll.map` giving each one's clip joint index (default 1 to 20 in order). `isFalling(slot)` is true while Gravity is on and the doll is free.
2. `ctx.clips = {play(slot, clipObject, opts), stop(slot), setTime(t)}` over `ClipPlayer` (`ClipPlayer.play` already takes a clip object and `opts.loop`, `ClipPlayer.stop`, `ClipPlayer.setTime`).
3. The scene saver (`scene_store.js` for big scenes) includes `GizmoNext.ragdoll.files()` and the loader calls `GizmoNext.ragdoll.restoreFiles(map)` before `GizmoNext.load`. Without this a clip is listed but not found, and the beat says "not on this computer".
4. Icons `record`, `voice` are optional. Add `gizmo_next_ragdoll.js` to `guest_manifest.json`.

## Cost

Clip conversion for 10 s about 0.05 ms. Recording at 60 Hz about 0.005 ms a tick. While playing, this part adds nothing: the page's clip player does the work.

## Open facts, and the default used

1. **Clip layout.** Followed from `clip_player.js` as read: `fps`, `frames[].q[0..21]` as `[x,y,z,w]`, `frames[].root`. The 22 slots follow the SMPL-X index order only as an index convention. No motion data from any restricted source is in these files.
2. **RAGP joint to clip index map.** Not in the package. Default 1 to 20 in order, to be set by `ctx.ragdoll.map`.
3. **Knee axis.** The audit reads flexion as the turn about the x axis, positive forward. If the body uses another convention, give the audit the right one or read the sign off one clip.
4. **The doll's frame.** Positions are world metres. The player removes the first frame's heading, so a fall plays the same from any start place and facing.
5. **A friend.** The clip file has to reach them (H9). Until then a friend's page has no clip and plays nothing.
6. **Quest frame cost** of playback is not measured.
