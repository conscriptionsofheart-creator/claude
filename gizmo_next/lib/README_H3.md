# README H3: the Trigger box gizmo

A gizmo kind `trigger` (Horizon's "Trigger zone" with Meta's field names where Meta has them). A see-through small box with the trigger picture and its name, and a real volume she resizes with the handles and two-hand scale. Selected, hovered or with its panel open it draws the whole volume (translucent fill, bright edges); otherwise only the small box. Photo, video and publishing leave it out. Hide gizmos hides it and the trigger keeps working.

Nothing runs on open. A trigger fires only when it is Enabled and Armed (Armed is off for a new or copied box) and Gizmos live is on, and only on the host's page. A friend's page never runs a trigger.

Depends on G0 and H1 (a greeting starts a named beat range). Part name `trigger`, needs `beats`. It adds named ranges to the beats part (see the end).

## Files

| File | What it is |
|---|---|
| `gizmo_next_trigger.js` | The kind, detection, panel rows, template. Added to `GizmoNext.PARTS`. |
| `gizmo_next_trigger_selftest.js` | 34 checks. `node gizmo_next_selftest.js --only=trigger`, or the demo page. |
| `gizmo_next_beats.js` | Extended: named ranges (`setRange`, `playRange`). H1 and H2 checks still pass. |
| `gizmo_next_demo.html` | The map now draws trigger boxes: Add trigger box, Greeting at the door, Arm all triggers. |
| `gizmo_next_H3_RAY_SPEC.md`, `wiki_trigger-box.json`, `lesson_trigger-box.md`, `CHANGES_H3.md`, `STAGE_REPORT_H3.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## The record and the panel

`{name, x, y, z, yaw, size:[w,h,d], enabled:true, armed:false, by:'players'|'objects', who:'anyone'|'guests'|'me'|'named', names:[], tags:[], figures:false, when:'enter'|'leave'|'both', often:'every'|'visit'|'ever'|'cooldown', cooldown:0, starts:[{do,arg,delay}], locked, group}`. The box is centred on `x, y, z` (the floor is `y` minus half the height). Max 12, copyable, resize by size.

Panel rows, Meta's names first: Triggered By (Players or Objects Tagged), Players (Anyone, Guests only, Just me, Named person), Named people, Objects Tagged, Include figures, Enabled, Armed, When (Someone enters, Someone leaves, Both), How often (Every time, Once per visitor, Once ever for each name, Cooldown), Cooldown (s). Then Test it, the list of starts (tap one to step its delay through 0, 0.5, 1, 2, 5 seconds; Remove start N), and Add rows for what can be added.

What it starts, in order, each after its delay: `beats` (a named range of the Beat strip, played once), `sound` (`id` or `id:loop` or `id:stop`), `spawn` (send the visitor to a spawn point), `seat` (sit the visitor), `script` (a function name), `show` and `hide` (an object by name).

## Detection

Host only, live only, armed and enabled only. Each tick it tests visitors' heads and feet against the oriented box: the local rig (`ctx.head()`), friends (`ctx.peers()`), figures if ticked (`ctx.figures()`), and props that carry one of the tags (`ctx.props()`). Enter and leave are edges with 15 cm of hysteresis, so standing on the edge does not flap. At most 40 box tests a frame, round robin. A trigger more than 25 m from every visitor sleeps. A visitor who disappears from the room counts as having left.

How often: Every time. Once per visitor (per visit: a visitor who leaves the room and comes back is new). Once ever for each name: kept per visit too unless `trigger.rememberNames = true` (default false), and then the names live only on the host's machine, never in the scene. Cooldown: no second fire within the cooldown seconds, whatever the mode.

## Events and the API

Bus: `g.on('enter', {trigger, id, who})`, `g.on('leave', ...)` (every edge of someone it listens to), `g.on('fire', {trigger, id, who, type, test})` (every time it starts things). `trigger.visitors(id)`, `trigger.test(id, fakeVisitor?)` ("Test it": fires as a fake visitor without anyone there; the log says "(test)"; delayed steps need Gizmos live on), `trigger.template('greeting')`, `trigger.whenOptions()` (for the headset "When..." rule), `starts(id)`, `setStarts`, `addStart`, `removeStart`, `setStart`, `setHover(id, on)`, `volumeShown(id)`, `isAsleep(id)`, `stats`. Every fire appends `{t, who, what}` to `g.logList()` (it shows under "what ran").

The template "Greeting at the door": Players, Guests only, Someone enters, Once per visitor, starts the beats range Greeting, not armed. If the Beat strip has beats and no range called Greeting, the template saves one covering all of them.

Sync: part `trigger` carries the fire text so a friend's log can show it. The host decides; H9 wires it fully.

## SEAT EDITS (this stage)

1. H3-1: the headset "When..." rule menu (`whenSub`) lists `GizmoNext.trigger.whenOptions()` (`{event, trigger, label}`), and a rule that picks one listens with `GizmoNext.on(event, fn)`.
2. In `lib/gizmo_next_host.js`: `ctx.peers()` with `head`, `feet` and `guest`; `ctx.localName()` (the host's name, default Me); `ctx.sounds.playMode`; `ctx.spawn.send(visitorId, pointId)`; `ctx.seat.sit(visitorId, seatId)`; `ctx.scripts.event('trigger', id, 'start', fnName)`; `ctx.setObjectVisible(name, on)`; `ctx.triggerChoices()` returning `{sound:[ids], spawn:[...], seat:[...], script:[...], show:[...], hide:[...]}` for the Add rows. Each is optional and a missing one gives one plain message.
3. A pointer hover over a trigger's pick sphere calls `GizmoNext.trigger.setHover(id, true or false)` so the volume draws while hovered.
4. The picture: the core draws it from the kind's glyph. Add `gizmo_next_trigger.js` to `guest_manifest.json`.

## Changes in the beats part

`setRange(name, a, b)`, `delRange`, `getRange`, `listRanges`, `playRange(name)` (plays from a to b once, whatever the loop mode, and leaves the bracket alone), the ranges are saved with the beats, and the strip rows gain "Save range: Greeting, Intro, Outro" (the bracket if there is one, else the whole strip).

## Cost

`trigger_12_triggers_tick_cost_ms_per_tick` about 0.04 ms with 12 armed boxes and 3 visitors. With Gizmos live off the tick only keeps the volume pictures in step.

## Open facts, and the default used

1. **Horizon label drift** (Triggered By against Trigger On): "Triggered By" is used.
2. **Meta's maximum trigger count** is unverified. 12 was chosen.
3. **Guests landing on the spawn point** (H0 number 1) does not affect triggers.
4. **The adapters** for spawn, seat, script, show and hide are named by this stage and tested against fakes. They are quiet until the matching stage supplies them.
5. **Saved Gizmos live.** A scene saved with Gizmos live on opens with it on (that is how G0 made it a per-scene switch), so an armed trigger can fire at once for someone already inside. A scene saved with it off opens quiet.
6. **Box height.** The volume is centred on `y`, so a doorway box is placed with `y` about 1 and a height of 2.
