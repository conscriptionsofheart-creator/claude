# Ray spec G0: the real-ray test of the kit

For the local seat. Run it in the Atelier and the BSA, in the headset emulator, with a real controller-ray press for every step. Never replace a press with a synthetic call. The numbers to read are in brackets.

## Setup

1. Make the seat edits E1 to E13 and G0-1 to G0-4 from `README_G0.md`.
2. Load `gizmo_next_probe.js` by hand after `gizmo_next_core.js` (leave it out of `PARTS` and the guest manifest). It adds one gizmo, the Probe box, which counts the frames it ran.
3. Start the page. Read `GizmoNext.ready` [true], `GizmoNext.isLive()` [false], `GizmoNext.version`. Read the console: no error, no warning from GizmoNext.

## Steps

1. Wrist menu, Objects, Gizmos. A Probe box tile is there beside Speaker, Seat, Light and Spawn point. [its picture is a box with a circle and a cross, not the speaker picture; tile edge in cm, at least 2.0]
2. Press the tile. A box comes out and settles in the hand. Put it down. [`GizmoNext.get('probe', id)` is not null; `marker.userData.isMarker` true; `marker.children[0]` is a sphere]
3. Tap the box once, quickly. Its panel opens at the top: Frames run, Enabled, and the usual rows below. [Frames run 0]
4. Wait 5 seconds with Gizmos live off, tap the box again. [Frames run still 0. This is "nothing runs".]
5. Wrist menu, Settings, Gizmos live, press the Gizmos live row. [row reads "Gizmos live: on"; `GizmoNext.isLive()` true]
6. Wait 2 seconds, tap the box. [Frames run at least 40 at 20 fps, about 140 at 72 fps; write the number]
7. Press Gizmos live again. Wait 2 seconds, tap the box. [Frames run the same as in step 6]
8. Squeeze the trigger on the box to grab it, move it about 1 m, let go. [record x and z within 2 cm of the marker; no second box]
9. Hover the box handle: one marker per axis opens into move, scale and turn. Use Fine Tune. [the same handles every other object has]
10. Grab with both hands and pull apart to double the size. [after release: `rec.size` doubled within 5 percent, marker scale 1,1,1]
11. Panel, Lock. Try to grab. [it does not move]. Unlock. Panel, Duplicate. [a second box with a new id; its Frames run starts at 0]
12. Panel, Delete. Objects, Recently deleted. [Probe box is listed]. Restore it. [same position and size, same id]. Press Undo once. [still one box, never two]
13. Objects, Gizmos, Hide gizmos. [the box and its marker vanish]. Turn Gizmos live on, wait 2 seconds, Show gizmos, tap the box. [Frames run rose while it was hidden]
14. Take a Photo. [no gizmo box in the picture]
15. Save scene, New scene, then open the saved scene. [the boxes are back; Gizmos live is what was saved; with live saved off, Frames run is 0 after opening and stays 0]
16. In the Atelier and the BSA right panel (2D). [a Gizmos live switch and an "Add probe box" button]. Press Add. [a box appears one metre ahead of the head]
17. Open the friend's tab through the guest door. [no gizmo boxes, no Add button, no Save, Export or Download control from GizmoNext; Gizmos live shows the host's state and cannot be changed from the guest tab]
18. With three Probe boxes live, read the frame rate on the emulator. [at least 20 fps; write the number. Quest cost is not measured until she tries it, and the report says so.]

## After

Take the probe loader out. Read the console once more. The kit stays; the first real kind is the Trigger box (stage H3).
