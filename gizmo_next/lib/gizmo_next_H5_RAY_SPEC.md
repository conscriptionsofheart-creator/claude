# Ray spec H5: the real-ray test of spawn points v2

For the local seat, after the seat edits in `README_H5.md`. Atelier and BSA, headset emulator, real controller-ray presses, and a second tab through the guest door for the friends. The numbers to read are in brackets.

## Steps

1. Wrist menu, Objects, Gizmos, Spawn point. Add a second one (the first is already there). [two spawn points exist; `SpawnPoint.list.length` is 2]
2. Tap point 2. In its panel the first row reads the defaults (Gravity 9.81, Speed 4, Order 1, fade 0.4 s). Set its Order to 2. [`GizmoNext.spawn.fields(id).order` is 2]
3. Press Check this point on a point you moved out over nothing. [a plain message says there is no floor; it is never used]. Move one into a wall. [a plain message says it is inside something solid]
4. Stand away from the points and press Test arrive on point 1. [you are moved there, facing its arrow, with a fade of 0.4 s and no flash; only you move]
5. Turn Set Position Only on and press Test arrive. [you land there but keep the way you were facing]
6. Turn Gizmos live on. A first friend joins through the guest door. [they land on point 1 facing its arrow; the host's log says "<name> arrived at Spawn point 1"]
7. Set Pick on point 1 to Take turns. A second friend joins. [they land on point 2]. A third. [point 1 again]
8. Set Who on point 2 to Named person and add the second friend's name. [only that friend can land there]
9. Set Respawn if I fall below to minus 5 m. Walk off a ledge or fly below it. [after the fall you are sent back to the point, once, with a fade; not again for 3 s]
10. Set Snap spot on a point. In Walk mode aim the teleport near it. [the aim snaps to its centre and takes its facing]
11. Set a trigger to Send to a spawn point with point 2 and walk a friend into it. [the friend lands on point 2]
12. Save the scene, start a New scene, open the saved one. [both points and their settings are back; nobody moved by itself]
13. Turn Gizmos live off and have another friend join. [the page's own point behaviour stands; this part moves nobody]
14. Frame rate with 4 points and 3 friends. [at least 20 fps on the Quest; write the number]
