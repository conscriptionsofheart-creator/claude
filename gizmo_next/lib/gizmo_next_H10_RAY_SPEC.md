# Ray spec H10: the real-ray test of the scripting layer

For the local seat, after SEAT EDITS H10-1 and H10-2. Atelier on desktop for the Scripts tab, then BSA in the headset emulator for the ray presses. Numbers to read are in brackets.

1. Open a saved scene that has scripts and blocks. [no script runs; the log is empty]
2. Open the Scripts tab. [the Blocks strip shows; pick the template Greeting at the door; a trigger box named Doorway appears, not armed; the code box shows code starting with "Made from blocks"]
3. Record a greeting on the Beat strip and name the range Greeting. Turn Scripts on and Gizmos live on. Press Test it with me. [the beats play; the log shows play beats Greeting (test); the first block is highlighted for about 1.5 s]
4. Change the wait in a rule and press Test it with me again. [the new wait is used]
5. Edit the code by hand. [the blocks grey out and say Edited as code]
6. Walk into the Doorway as a guest and as the host. [guest rule runs for a guest only]
7. Template Doorbell: step on the bell. [a sound rings and the second rule says Someone is at the door]
8. Template Welcome chair with a seat called Chair 1: step on the mat. [after 1 s you are seated; stand up works]
9. A script that sends emit('ping') to another script. [the other script hears it; a script that emits to itself stops after 6 levels]
10. A script with fields({speed: {type:'number', default:1}}). [the Objects panel shows Speed: 1 and Speed lower; changing it changes what the script reads; save, reopen: it keeps the value]
11. world.raycast from the head forward with a tag. [it returns the first tagged object and its distance, and null when nothing is there]
12. Spawn 25 objects in a loop. [20 appear; the log says Spawn budget reached (20)]
13. Turn Scripts off with a timer pending. [the timer never fires; hidden objects come back; spawned objects are gone]
14. A script that throws. [the log shows ERROR; other scripts and gizmos keep running; after 5 errors it stops with a plain message]
15. Turn Visitor counts on, walk through twice, read visitor.count('YourName'). [2; the file is not in the saved scene]
16. Frame rate with 3 scripts running at 60 Hz. [at least 20 fps on the Quest; write the number]
