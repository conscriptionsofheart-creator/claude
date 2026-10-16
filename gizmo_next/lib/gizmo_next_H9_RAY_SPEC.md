# Ray spec H9: two tabs, a host and a friend

For the local seat, after the edits in `README_H9.md`. Tab A is the host. Tab B joins through the guest door (a private window is fine). The numbers to read are in brackets.

## Steps

1. Tab A: place a Trigger box, an Effects gizmo, a Seat and a Spawn point, record two beats and name the range Greeting, make the trigger play Greeting, arm it. Turn Gizmos live on. [nothing plays]
2. Open Tab B through the guest door. [within 5 s Tab B shows the same trigger, effects, seat and spawn point; Gizmos live is on there; read the checksums in both: they agree]
3. In Tab B look for Save, Export, Download in every panel and menu. [none]
4. Tab A: walk the host's own rig into the trigger box. [the Beat strip plays on Tab A and on Tab B; the friend's beat time is within 0.3 s of the host's; read the number]
5. Tab B: walk the friend into the trigger box. [nothing is fired from Tab B; Tab A fires once for the friend; Tab B plays the beats again]
6. Tab A: press Stop on the Beat strip. [Tab B stops within 0.5 s]
7. Tab A: Loop the effect, then Stop. [Tab B sees it start and stop]
8. Tab A: sit on the seat. [Tab B shows the seat as taken and a Sit tile does not appear for the friend]
9. Tab A: Test arrive with the friend's name on the spawn point. [Tab B's rig moves with the 0.4 s fade]
10. Tab A: change a beat. [Tab B follows in 2 s and the checksums agree again]
11. Tab B: try to add a trigger box, press Play on an effect, edit a beat. [refused]
12. Tab A: turn Gizmos live off. [Tab B goes off too]
13. Save in Tab A, New scene, open the saved scene. [nothing plays]. Close Tab B and open it again. [it gets the scene again]
14. Make the project private. [nothing is sent; Tab B gets nothing]
15. Open the browser network list for Tab B. [only files from `guest_files_list.txt` are fetched; /pe_narrate and /pe_narration are refused]
