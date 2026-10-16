# STAGE REPORT H9: friends and saving

**Done.** `gizmo_next_sync.js` (part `friends`), selftest with a host and guest pair, `guest_files_list.txt`, demo button, README, CHANGES, two-tab RAY SPEC, wiki card and change row, lesson draft. Late-joiner snapshot (sent in pieces, asked for by the friend), checksums, live follows the host, seat taken shows for a friend, `trigger {id, fired, who, t}`, friends cannot add, save, export or download, nothing sent when private.

**Selftest.** 20/20 (255/255 with earlier stages), in node and the demo page in headless Chromium. Host to friend beat start 83 ms (limit 300).

**Untested.** Real room, real `room_sync.js` and `room_presence.js`, two real tabs, network loss, the real guest door and manifest.

**The seat wires in.** `ctx.sync`, `GizmoNext.sync.apply` for each message, `friends.onJoin()` on a join (optional), `ctx.mirror {seats, spawns}` on a friend's page, the files in `guest_files_list.txt` in `guest_manifest.json`, presence `seat:<id>`.

**Open facts, defaults used.**
1. Voice for a friend: Share audio (Ruth's call).
2. Scene limit about 220 KB of text.
3. No clock offset estimate.

**One question.** Voice file read-only in the manifest, or Share audio? If no answer, Share audio stays.
