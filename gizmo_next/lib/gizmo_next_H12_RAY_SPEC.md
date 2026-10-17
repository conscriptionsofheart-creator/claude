# Ray spec H12: the real-ray version of Ruth's example, with a friend's tab

For the local seat. Two tabs: Tab A is the host (Atelier or BSA), Tab B joins through the guest door. Every press is a real controller-ray press (headset emulator), audio is muted and read through an AnalyserNode, and joint audits run at 60 Hz. The numbers to read are in brackets. If a stage this depends on (G0, H1, H2, H3, H9) is not wired in yet, skip its steps and write which.

## Setup

Tab A: the scene is open, a figure is selected, Gizmos live is off. Tab B: the friend is in the room but standing outside the doorway.

## Steps

1. Tab A: pose the figure with one hand raised. [wrist y above the head]
2. On the figure's Voice page record "hello friend!" in your own voice. [the recording lists with its length; read it]
3. Beat strip: press Add beat. Attach the recording as a say beat on that card. [the say beat's hold equals the recording length, within 0.05 s]. Move the hand right and press Add beat. Move it left and press Add beat. [the strip has three pose cards; the wrist x at the beat times has three different values; tolerance 2 cm]
4. Place a Trigger box in the doorway: Triggered By Players, Guests only, When Someone enters, How often Once per visitor, start Play beats Greeting (name the range first). Arm it. Turn Gizmos live on. [nothing fires: nobody is inside]
5. Press Play. [the figure waves; the voice plays once; the jaw bone moves while it plays and stops after; read the jaw angle at 60 Hz and the AnalyserNode level]. Press Stop. [the figure goes back to where it was]
6. Tab B: the friend walks into the doorway. [exactly one start on Tab A; Tab B shows the wave; the friend's beat time is within 0.3 s of the host's; read both; the voice reaches the friend through Share audio and starts within 0.3 s of the wave]
7. A second friend walks in. [it fires again, one more start]
8. The first friend steps out of the doorway and back in without leaving the room. [no second fire]. The first friend leaves the room and returns. [it fires again]
9. Turn Gizmos live off and walk in. [nothing fires]. Turn live on and disarm the box and walk in. [nothing fires]
10. Turn Hide gizmos on and walk in. [it still fires]
11. Save the scene, start a New scene, open the saved one with nobody in the doorway. [pins, range, trigger and settings are back; nothing plays on open]
12. Tab B: look in every panel and menu for Export, Download or Save. [none]; try to add a beat or a trigger. [refused]
13. Read the frame rate on the emulator with both tabs open and the greeting playing. [at least 20 fps; write the number; Quest cost is unmeasured until she tries it]
