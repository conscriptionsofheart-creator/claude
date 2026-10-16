# Ray spec H6: the real-ray test of the Sit tile and seat v2

For the local seat, after the seat edits in `README_H6.md`. Atelier and BSA, headset emulator, real controller-ray presses and the stick, joint audits at the page's 60 Hz step. The numbers to read are in brackets.

## Steps

1. Place a chair seat. Walk toward it in Walk mode and look at it. [a Sit tile appears at 80 cm from it, and not at 2 m; its picture has no words in the headset; the tile edge is at least 2.0 cm]
2. Walk up to the seat with your back to it, then sideways. [no Sit tile unless you face it, within 60 degrees]
3. Turn Fly on and fly past the seat. [no Sit tile while flying]
4. Walk back to the seat, face it, and press the Sit tile with a real ray. [the edges fade over 0.25 s; you rise or sink to the seat; read the head height: seat height plus 0.46 of your stature, within 3 cm; your body's scale is still 1; walking is off]
5. Look at the body in a mirror. [it sits: hips low, knees bent, feet on the floor; it blends in over 0.6 s]
6. Push the stick forward, sideways, back a little. [nothing happens]. Pull the stick back all the way. [it stands you up over 0.5 s, on the floor in front of the seat; the floor height is the real floor there]
7. Set Pose to a sit from the pose library on the seat and sit again. [the library pose blends in over 0.6 s; the head is still at the target height]. Take the pose library away (or choose Default sit). [the default sit, with one plain message]
8. Turn Use Custom Exit Direction on and set Exit Direction to Right. Sit and stand. [you stand to the seat's right, facing the way you were standing]
9. Press Nudge up 2 cm three times and sit. [the head target rose by 6 cm]. Reset the nudge.
10. Put the seat on a sofa model and turn Height from the surface on. [the head target follows the sofa's top]
11. Set Who can use it to Guests and walk up as the host. [no Sit tile for you]. A friend walks up through the guest door. [the tile shows for them (H9 decides what they see)]
12. Sit, and have a figure try the same seat. [the figure is refused with "That seat is taken."]. Stand, then a seat beat on a figure sits it, and a stand beat stands it. [the figure's head is at the seat plus 0.46 of its own stature]
13. Save the scene, start a New scene, open the saved one. [the seat settings are back; nobody sat by itself]
14. Frame rate while seated, with 4 figures. [at least 20 fps on the Quest; write the number]
