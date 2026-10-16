# Ray spec H8: the real-ray test of the Effects gizmo

For the local seat, after the edits in `README_H8.md`. Atelier and BSA, headset emulator, real controller-ray presses. Numbers to read are in brackets.

1. Open a saved scene that has an Effects gizmo set to Play on Start. [nothing plays]. Turn Gizmos live on. [it starts]. Turn it off. [it stops and clears]
2. Add an Effects gizmo, choose Confetti, press Play once with live on. [a burst for about 0.3 s, then it ends by itself within 3 s; no more particles]
3. Press Loop. [it keeps going for a minute]. Press Stop. [every particle is gone at once]
4. Press Stop then Loop as fast as you can, 10 times. [it never flashes; restarts are at least 0.4 s apart]
5. Press Start colour and End colour fast. [the colour glides; it never flickers]
6. Put 12 effects gizmos on Loop. [the particle count stays at 600 or under; read the frame rate: at least 20 fps on the Quest; write the number]
7. Trail tab, Follow a prop, move the prop. [a ribbon follows it]. Move it fast. [the ribbon stays 64 points or fewer]. Press Stop. [the ribbon is gone]
8. Follow Hand right and wave. [the ribbon follows the hand]
9. Hide gizmos on. [the box goes, the effect keeps playing]
10. A beat of kind Effect starts a Loop and a later one stops it. [it follows the Beat strip]. Press Stop on the strip during a loop a beat started. [the loop stops]
11. Save, New scene, open the saved one. [the settings are back; nothing plays]
12. A friend joins through the guest door while a loop runs. [they see it; they have no Play or Stop]
