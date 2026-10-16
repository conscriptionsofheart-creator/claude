# Ray spec H3: the real-ray test of the Trigger box

For the local seat, after the seat edits in `README_H3.md` and the H1 and H2 tests. Atelier and BSA, headset emulator, a real controller-ray press for every step, and a second tab through the guest door for the friend. The numbers to read are in brackets.

## Steps

1. Wrist menu, Objects, Gizmos. A Trigger box tile is there with its own picture. [tile edge at least 2.0 cm]
2. Press the tile. A small box comes out and settles in the hand. Put it in a doorway. [`GizmoNext.get('trigger', id)` is not null; `armed` false; `marker.userData.isMarker` true]
3. Hover the box. [the whole translucent volume and its bright edges draw; move away and only the small box shows]
4. Tap the box. The panel opens at the top: Triggered By, Players, Enabled, Armed, When, How often, Test it. [the volume draws while the panel is open]
5. Grab one handle and stretch the box to fill the doorway, then grab with both hands to scale. [`rec.size` follows within 5 percent; marker scale back to 1,1,1]
6. Set Players to Guests only, When to Someone enters, How often to Once per visitor. Add: Play beats, with a range called Greeting saved on the Beat strip. [the start appears in the list]
7. Press Test it. [the log under Gizmos live says "A test visitor entered (test)" and the Greeting beats play]
8. Walk the rig through the box with the stick, Armed off, Gizmos live off. [nothing fires; the log is empty]
9. Turn Armed on, Gizmos live off, walk in. [nothing fires]. Turn Gizmos live on, walk in as the host. [nothing fires: Guests only ignores the host's head]
10. A friend joins through the guest door and walks into the box. [Greeting plays once on the host within 0.2 s; the log says "<name> entered"; the friend leaves and comes back: nothing again; a second friend: it plays]
11. Stand on the edge of the box, sway 5 cm in and out. [one enter, no leave until 15 cm outside]
12. Press Hide gizmos, then walk a friend in. [the box is gone from view; it still fires]
13. Take a Photo. [no trigger box or volume in the picture]
14. Make 12 triggers. [the 13th is refused with a plain message]. Count frame time with 12 armed and 3 people. [at least 20 fps on the Quest; write the number]
15. Walk 30 m from a trigger. [`GizmoNext.trigger.isAsleep(id)` true]
16. Save the scene, start a New scene, open the saved one. [the box is back, nothing fired by itself, `armed` as saved]. Copy an armed trigger. [the copy is not armed]
17. In the headset "When..." rule menu pick "Someone enters <trigger name>". [the rule runs when someone enters]
