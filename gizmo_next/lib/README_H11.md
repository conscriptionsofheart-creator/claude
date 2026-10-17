# README H11: seven small gaps

Seven small items in one part, `small` (`gizmo_next_small.js`), plus a materials patch. Each is a few lines of code and a test. Where a fact was missing it was given a default and listed under open facts. Nothing runs when a scene opens.

Depends on G0 and H2 (the camera action kind). In `GizmoNext.PARTS` and `guest_files_list.txt`. Core change: a kind can say `strMax: {text: 1000}` to allow a longer text field than the usual 80 characters.

## Files

| File | What it is |
|---|---|
| `gizmo_next_small.js` | Part `small`: kinds `text` and `door`, material check, light budget, mirror cost, camera fade, sound pitch and min distance. |
| `objcfg_mats_patch.json` | Two new materials for `ObjCfg.MATS` (SEAT EDIT H11-1). |
| `gizmo_next_small_selftest.js` | 17 checks. `node gizmo_next_selftest.js --only=small`, or the demo page. |
| `gizmo_next_H11_RAY_SPEC.md`, `wiki_small-gizmos.json`, `lesson_small-gizmos.md`, `CHANGES_H11.md`, `STAGE_REPORT_H11.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## 1 Text sign (`g.modules.small.text`)

Kind `text` (colour `#f3eee2`, up to 12, resizable box, default 1.2 by 0.5 m). Record `{text, autoFit, fontSize, visible, size}`. Meta's fields: Text string (1000 characters; the cap holds when saving, loading and setting), Auto Fit, Fixed Font Size (8 to 200), Visible. `layout(text, boxW, boxH, {autoFit, fontSize})` is pure: Auto Fit shrinks the letters (down to 8) until the words fit the box; a fixed size never shrinks and says `overflow` when the words do not fit. It is drawn on a flat unlit canvas plane in its own layer, so Hide gizmos hides the box and the sign stays. Dashes in the words become commas. API: `add`, `get`, `setText(id, t)`, `plane(id)`, `layoutOf(id)`; rows Words (cycles four sample lines), Auto Fit, Fixed Font Size, Visible. No keyboard exists in the headset, so typing is the seat's to wire to `setText`.

## 2 Door to a saved scene (`small.door`)

Kind `door`, record `{sceneName, thumbKey}`. `go(id)` calls `ctx.openScene(name)` and only when Gizmos live is on; a guest may only go to a scene in `ctx.sharedScenes()` and a guest's page does not show other doors (`visibleFor(id, true)`). It never opens by itself: only `go`. Choices come from `ctx.sceneList()` (host) or the shared list. Rows: Go to X, Scene.

## 3 Materials

`objcfg_mats_patch.json`: Softwood (b 0.25, fr 6, air 0.2, ay 0) and Super ice (b 0.1, fr 0.15, air 0.1, ay 0). `small.mats.check()` tests the values against the table the app already has (a quarter of its lowest to one and a quarter of its highest, because Super ice is meant to be slipperier than Ice). **SEAT EDIT H11-1:** merge the two entries into `ObjCfg.MATS` in `obj_cfg.js` and add them to the material choice list.

## 4 Light budget

`small.light.check()` counts `ctx.lights()` and, above 20, says in plain words: "This scene has 21 lights. Meta suggests no more than 20 moving lights at once, so it may run slowly. Turn some off or delete some." Said once for each new count; the Settings page "Scene limits" shows the count. 20 does not warn.

## 5 Mirror cost fields (`small.mirror`)

Per mirror id: Render Radius 16 m, Near LOD 3, Far LOD 15, Near resolution 540p, Far resolution 360p, Near frame rate 30, Far frame rate 20 (Meta's defaults), each kept in range, far never above near. `cost(fields)` is 0 to 1 and rises with radius, resolution and frame rate (Meta's defaults come to about 0.24). `equalScale([x,y,z])` makes the scale equal. `advice(count)` says one mirror is recommended when there are more. Rows including Mirror cost. Saved with the scene. The mirror object itself is the page's `Mirrors`; the seat applies these values to it.

## 6 Camera beat

The `camera {shot}` beat now checks the shot against `ctx.camera.shots()` when the page has one, calls `ctx.camera.shot(name, {fadeSec: 0.4})`, holds 0.4 s, and counts as a look change, so two camera cuts (or a look and a cut) are at least 0.4 s apart and no more than three a second. A pure dip `shotFade(t)` rises to 0.5 over 0.2 s and falls over 0.2 s (2.5 a second at most); each frame it is sent to `ctx.camera.fade(alpha)` if the page has it.

## 7 Sound pitch and min distance (`small.sound`)

Per sound id: Pitch 0.5 to 2, Min distance 0.1 to 20 m, Fade 0.4 to 10 s. `set(id, patch)` clamps and calls `ctx.sounds.set(id, {pitch, minDistance, fade})`. Rows: Pitch, Pitch down and Pitch up (a semitone each), Min distance, Fade.

## SEAT EDITS

H11-1 materials, as above. Also: `ctx.openScene(name)`, `ctx.sharedScenes()`, `ctx.sceneList()`, `ctx.lights()`, `ctx.camera.shots()`, `ctx.camera.shot(name, {fadeSec})`, `ctx.camera.fade(alpha)`, `ctx.sounds.set(id, {pitch, minDistance, fade})`, and the panel rows from each `rows` call. The camera shots in `camera_beats.js` are one camera per song line, not named shots, so `shots()` must name them.

## Open facts, and the default used

1. **Material numbers** are not from a source; they are the stage file's. Super ice's friction 0.15 is below Ice's 0.4 on purpose.
2. Meta caps were not found for the Text, Door and Mirror gizmos beyond what the stage file lists.
3. Text width is estimated as 0.52 of the letter size per character; the page can pass a real measure.
4. Door thumbnails: `thumbKey` is the scene name; making the picture is the page's.
5. The mirror cost formula and the 0.5 dip depth are mine.
6. Quest frame cost is not measured.
