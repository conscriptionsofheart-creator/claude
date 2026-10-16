# README H9: friends and saving

The host decides and the friend follows. The core already had the sync table (`GizmoNext.sync.parts()`, `encodeAll(P)`, `validate(name, v)`, `apply(name, v, from)`): every part checked, 16 KB a part, 10 messages a second a part, nothing sent in a private project, apply refused on the host. This stage adds what a friend needs on top, and tests all of it with a host page and a guest page joined by a fake room (80 ms delay, fake time).

Depends on H1 (beats), H3 (trigger), H5 (spawn), H6 (seat), H8 (effects). Part name `friends`, file `gizmo_next_sync.js`, last in `GizmoNext.PARTS`.

## Files

| File | What it is |
|---|---|
| `gizmo_next_sync.js` | The `friends` part: snapshot, ask for it, live flag, seat mirror, checksums, `GizmoNext.guestFiles()`. |
| `gizmo_next_sync_selftest.js` | 20 checks, a host and guest pair. `node gizmo_next_selftest.js --only=sync`, or the demo page. |
| `guest_files_list.txt` | Every file a friend's page must be allowed to fetch. A check compares it with the code. |
| `gizmo_next_seat.js`, `gizmo_next_trigger.js`, `gizmo_next_effects.js`, `gizmo_next_testkit.js`, `gizmo_next_host_TEMPLATE.js`, `gizmo_next_demo.html` | Changed a little (see CHANGES_H9). |
| `gizmo_next_H9_RAY_SPEC.md`, `wiki_gizmo-sync.json`, `lesson_gizmo-sync.md`, `CHANGES_H9.md`, `STAGE_REPORT_H9.md` | Two-tab ray test, wiki card and change row, lesson draft, change note, report. |

## Messages (all validated on the friend's page, none obeyed on the host)

| Part | Shape | Who sends |
|---|---|---|
| `beats` | `{st, t, speed, mode, br, h, n}` | Host, when the transport changes and every 2 s while playing. The friend follows only if `h` (the beat list hash) equals its own. |
| `trigger` | `{id, fired:true, who, t}` | Host, when a trigger fires (a log line for the friend). |
| `seat` | `{id, who, state:'enter'|'exit'}` | Host, so a taken seat reads as taken on the friend's page. The host is shown as `host`, the friend's own id as `me`. |
| `spawn` | `{who, x, y, z, yaw, fadeSec, ...}` | Host, obeyed only by the friend named in `who`, with the fade. |
| `fx` | `{id, mode:'once'|'loop'|'stop'}` | Host, so a friend sees effects play and stop. |
| `gizmos` | `{live}` | Host, when Gizmos live changes. |
| `snap` | `{id, i, n, h, d}` | Host. One piece of the snapshot (3500 characters a piece, up to 64 pieces, 8 a second). |
| `snapreq` | `{v:1}` | A friend, once every 2 s (8 times at most) until the snapshot has arrived. The host answers at most once in 3 s. Nothing else a friend sends is obeyed. |

## The snapshot

`snapshot()` is `{v:1, live, kinds:{trigger, effects}, parts:{beats, seat, spawn, effects, walk}, seats, spawns, occ}`: the beat list and named ranges, trigger and effects records (no runtime memory such as who has visited), the seat and spawn lists and their extras, who sits where. It is sent when the friend asks, when `onJoin()` is called, and by itself within 1.5 s of anything the friend sees changing. The friend checks the whole text against its hash, loads it, then follows `live`. A wrong or cut-off set is dropped and asked for again. The ragdoll clips and sounds are not in it.

`checksum()` gives a short text for beats, triggers, effects, seats, spawns and live, and `all`. Host and friend must agree once the snapshot has arrived.

## What a friend can and cannot do

A friend's page holds the host's scene for this visit only. `persist`, `putFile`, `setLive` from the page, adding a trigger or effects gizmo, play and stop of an effect, and firing a trigger are all refused. A check builds every panel with the guest flag and scans the words and attributes for save, export and download: none. A friend's page sends nothing except `snapreq` (a check counts the messages).

## What the local seat does (SEAT EDITS E10 and E12)

1. `ctx.sync {send(name, obj), on(name, fn(obj, from))}` over the room endpoint, and call `GizmoNext.sync.apply(name, obj, from)` for each incoming message (the core already wires `on` for each part name; this stage adds `snap`, `seat`, `snapreq`).
2. On a friend joining (room presence), call `GizmoNext.friends.onJoin()` on the host. It is optional, because a joining page asks for itself.
3. Add `ctx.mirror {seats(list), spawns(list)}` on the friend's page: show the host's seat and spawn lists (records `{id, name, x, y, z, yaw, preset}`) as read-only copies. No such call exists in the app yet.
4. Add every file in `guest_files_list.txt` to `guest_manifest.json`. Do not add the wiki image or any export, save or download route. Do not add a route for voice audio (see open facts).
5. Presence: add `seat:<id>` for a friend who sits (the friend's own sit is local to their page).
6. Run the two-tab ray spec.

## Open facts, and the default used

1. **Voice audio for a friend** (Ruth's call): add the one voice file read-only to the manifest, or the friend hears it through Share audio. Default: **Share audio** (no new fetchable address for her voice).
2. The beat list is shared by the snapshot, so a very long list (over about 220 KB of text) is refused with one plain message.
3. The friend follows the host's time as sent, so it runs about the room delay behind (83 ms in the check, limit 0.3 s). No clock offset is estimated.
4. `room_sync.js` and `room_presence.js` were not read; the check uses the core's sync table and a fake room. Names to check: the page's join event and the endpoint's send and on.
5. A friend sitting down is not told to the host or to other friends (guest messages are not obeyed). Presence `seat:<id>` carries it.
