# The Living Face: Facial Emotional Design

> Copy of the live doc at https://claude.ai/code/artifact/ab111a4d-28c0-4c2e-a27e-8fc5d3669ebb (the doc is the master: comments and edits go there). Saved here so every lane can read it from the repo. The 8-shape-key limit in chapter 11 is now handled by `scripts/sculpt_next_morphs.js`.

*A working book for building faces that feel, for the Atelier, BSA and Leslie's face stations*

Oct 14, 2026 · @Ruth Diaz, Psy.D.

## Preface: the face is the plan

Everything else in this plan is a stage for one thing: a figure whose face makes you believe it feels. Bodies, sculpting, skins, shaders and motion all serve that moment. If the face is flat, the rest is a well-lit mannequin.

This book is the method for building those faces. It replaces tuning weights by eye with a fixed order of work, a shared vocabulary and recipes you can check.

**Who it is for.**

- **You.** You decide what each face must feel like and judge whether it does.
- **The lanes building faces.** They are Leslie's face stations, any session that sculpts shape keys or writes expression code.
- **The blind checker.** It reviews faces without seeing who made them, and needs a rubric instead of taste.

**How to use it.**

- Chapters 1 and 2 explain why faces fail and which muscles move.
- Chapter 3 is the shared vocabulary: action units, the alphabet of the face.
- Chapters 4 to 10 are the craft, region by region. They run in the order experts work: eyes and brows, then cheeks and mouth, then the emotions, blends, timing and body.
- Chapters 11 to 13 put it into figures and check the result.
- The appendices hold numbers ready for code.

**What is science and what is craft.** Three kinds of claim appear here, and each is labelled.

- **Measured.** Published research with data, such as Ekman and Friesen's Facial Action Coding System (FACS), blink rates and Keltner's embarrassment studies. Each comes with its source.
- **Craft.** What animators teach from decades of practice, such as Faigin, Osipa, Thomas and Johnston. It is not measured, but it is the standard of the field.
- **Our choice.** Numbers picked for these figures where neither science nor craft gives one, such as a starting shape-key weight. Each says so, and each is meant to be tuned against your eye.

The author has not read the paywalled books end to end. Their teaching is given as the field widely reports it, and the Sources section marks what was read directly. Where research runs out, as it does for shame and longing, the book says so instead of filling the gap with confidence.

## 1. What makes a face believable

A face reads as alive when the parts that betray feeling move first, move unevenly and never stop. A face reads as dead when it is assembled mouth-first and then held still. Nearly every failed expression comes from one of five mistakes.

**The five failures**

1. **Dead eyes.** The mouth smiles but the eyes stay flat. People read the eyes and brows first, and the cheek raise that crinkles them is half of a real smile (Duchenne, chapter 5). Half-lidded, unmoving, unfocused eyes are the most common complaint, and the blind checker's.
2. **Mouth-first building.** The mouth is the easiest part to push, so it gets tuned first and carries the expression. In real faces the mouth is the part people control best, so it is the least trusted. Build from the top of the face down (chapter 12).
3. **Perfect symmetry.** Mirrored keys make a mask. Real faces are a little uneven at rest and more uneven in motion: one brow higher, one lip corner slower, blinks that close the two lids a few milliseconds apart (chapter 4).
4. **Held poses.** An expression switched on and held is a photograph glued to a head. A living face eases into an expression, overshoots slightly, settles and keeps drifting: small lid changes, breath, tiny gaze shifts (chapter 9).
5. **Wrong timing.** Every emotion has a speed. Surprise snaps on and fades within a second; sadness creeps in and lingers; a polite smile appears and vanishes too abruptly; a felt one swells and fades smoothly. The right shape at the wrong speed reads as false.

**The uncanny valley.** The closer a figure gets to human, the less a viewer forgives. A cartoon with stiff eyes is charming; a near-real face with stiff eyes is disturbing. Leslie's figures are realistic, so they are judged by human standards. The way out is not less realism but more life: eyes that move and focus, lids that track the gaze, skin that bunches, timing that breathes.

**The rule this book follows: the eyes lead.** Attention and feeling show in the eyes first, then the head turns, then the body follows. Expressions are built in the same order, starting at the brows and lids, then the cheeks, then the mouth and jaw, then the head and body.

## 2. The anatomy that moves

About twenty paired muscles make every expression, and almost all of them pull skin, not bone. Only the jaw moves bone. So an expression is skin sliding, bunching and folding over a fixed skull. A shape key that moves the skull, or moves skin with no bunching where it gathers, looks rubbery.

| Region | Muscle | What it does to the skin | Where the skin bunches or folds |
| --- | --- | --- | --- |
| Forehead | Frontalis, inner part | lifts the inner ends of the brows | short horizontal lines in the middle of the forehead |
| Forehead | Frontalis, outer part | lifts the outer ends of the brows | long horizontal lines across the forehead |
| Brow | Corrugator supercilii | pulls the brows together and down | vertical lines between the brows |
| Brow | Procerus, depressor supercilii | pull the inner brows and the skin between them down | horizontal wrinkle across the top of the nose |
| Eye | Orbicularis oculi, outer ring | squeezes the eye from outside, lifts the cheek | crow's feet at the outer corners, bags under the lower lid |
| Eye | Orbicularis oculi, lid part | narrows the eye, tightens the lids, blinks | lower lid straightens and rises |
| Eye | Levator palpebrae | lifts the upper lid | the lid fold deepens and disappears as the lid rises |
| Nose | Levator labii superioris alaeque nasi | wrinkles the nose, lifts the nostril wings | wrinkles across the bridge, deepened nasolabial fold |
| Cheek, lip | Levator labii superioris | lifts the upper lip | upper part of the nasolabial fold deepens |
| Cheek | Zygomaticus major | pulls the lip corners up and out toward the ears | nasolabial fold deepens and curves, cheek pad rises |
| Cheek | Zygomaticus minor | deepens the fold, lifts the upper lip a little | middle of the nasolabial fold |
| Mouth | Buccinator, risorius | pull the lip corners straight back | lips flatten, small vertical folds at the corners |
| Mouth | Depressor anguli oris | pulls the lip corners down | small fold below the corners |
| Mouth | Depressor labii inferioris | pulls the lower lip down and out | shows the lower teeth |
| Chin | Mentalis | pushes the chin boss and lower lip up | dimpled chin, lower lip pouts |
| Mouth | Orbicularis oris | tightens, presses, puckers and funnels the lips | lips thin, roll or push out |
| Mouth | Platysma | stretches the neck and pulls the mouth down and wide | neck cords stand out |
| Jaw | Masseter, temporalis, digastric | close and open the jaw (bone) | cheek and chin skin stretch over the moving jaw |

**Three things to carry into every face.**

- **Skin gathers where it is pushed.** A smile lifts the cheek pad into the lower lid, which pushes the lower lid up and makes the eye narrower from below. A brow frown piles skin between the brows. Keys need that volume to move, not just the edge to slide.
- **Folds are permanent creases that deepen.** The nasolabial fold, the lid fold and the lines of the forehead exist at rest in an adult face. Expressions deepen them, so the neutral face should already carry faint versions.
- **The eyeball never changes shape.** Lids slide over a sphere. A lid key that dents the eye or lets the lid cut through it breaks the illusion at once. The eye moves as a whole, and the lids follow it (chapter 4).

Source: muscle names and actions as given in the FACS manual's muscle list and Faigin, chapters on the muscles (craft and anatomy, widely reproduced).

## 3. FACS in working terms

The Facial Action Coding System (FACS), by Paul Ekman and Wallace Friesen (1978, revised with Joseph Hager in 2002), breaks every visible face movement into numbered **action units** (AUs). Each AU is one muscle or muscle group. Every expression is a set of AUs, each at an intensity. It is the vocabulary this book uses, and the one the lanes and the checker should use: "add AU17 at C" is exact, "make it sadder" is not.

**Intensity** is scored with five letters, from the faintest visible trace to the strongest the face can make. Appendix B maps them to shape-key weights.

| Letter | Meaning | Starting weight (our choice) |
| --- | --- | --- |
| A | trace | 0.15 |
| B | slight | 0.35 |
| C | marked or pronounced | 0.55 |
| D | severe or extreme | 0.8 |
| E | maximum | 1.0 |

**Upper face**

| AU | Name | Muscle | What you see |
| --- | --- | --- | --- |
| 1 | Inner brow raiser | frontalis, inner | inner brow ends lift; brows slope up toward the middle |
| 2 | Outer brow raiser | frontalis, outer | outer brow ends lift; arched, surprised brow |
| 4 | Brow lowerer | corrugator, depressor supercilii, procerus | brows pull down and together; vertical lines between them |
| 5 | Upper lid raiser | levator palpebrae superioris | upper lid lifts; white shows above the iris at C and up |
| 6 | Cheek raiser | orbicularis oculi, outer ring | cheek lifts, crow's feet, lower lid pushed up from below |
| 7 | Lid tightener | orbicularis oculi, lid part | lids narrow and straighten, lower lid most; a hard stare |
| 41 | Lid droop | relaxed levator | upper lid sags; sleepy or sad |
| 42 | Slit | orbicularis oculi | eyes nearly closed, still open |
| 43 | Eyes closed | relaxed levator | lids closed and held |
| 44 | Squint | orbicularis oculi, lid part | narrowing focused on the lids |
| 45 | Blink | levator relaxes, orbicularis contracts | a quick close and open |
| 46 | Wink | orbicularis oculi | one eye blinks |

**Nose, cheeks and lips**

| AU | Name | Muscle | What you see |
| --- | --- | --- | --- |
| 9 | Nose wrinkler | levator labii superioris alaeque nasi | nose wrinkles, nostrils lift, brows pulled down at the middle |
| 10 | Upper lip raiser | levator labii superioris | upper lip lifts, nasolabial fold deepens at the top |
| 11 | Nasolabial deepener | zygomaticus minor | fold deepens without the lip corners rising |
| 12 | Lip corner puller | zygomaticus major | corners pull up and out: the smile |
| 13 | Sharp lip puller (cheek puffer) | levator anguli oris | corners pull up sharply, cheeks puff |
| 14 | Dimpler | buccinator | corners tighten and pull in; dimple; a contained or smug look |
| 15 | Lip corner depressor | depressor anguli oris | corners pull down |
| 16 | Lower lip depressor | depressor labii inferioris | lower lip pulls down, lower teeth show |
| 17 | Chin raiser | mentalis | chin boss pushes up, lower lip pouts, chin dimples |
| 18 | Lip pucker | incisivii labii | lips push forward as if to kiss |
| 20 | Lip stretcher | risorius, platysma | lips stretch sideways, flatten; fear |
| 22 | Lip funneler | orbicularis oris | lips push out in a funnel, as saying "sh" |
| 23 | Lip tightener | orbicularis oris | lips narrow and harden, red part thins |
| 24 | Lip pressor | orbicularis oris | lips press together; a bulge above and below |
| 25 | Lips part | relaxed mentalis or depressor | lips separate |
| 26 | Jaw drop | relaxed masseter, temporalis | jaw falls, mouth open without effort |
| 27 | Mouth stretch | pterygoids, digastric | mouth forced wide open |
| 28 | Lip suck | orbicularis oris | lips rolled in over the teeth |

**Head and eyes**

| AU | Movement |
| --- | --- |
| 51, 52 | head turns left, right |
| 53, 54 | head up, head down |
| 55, 56 | head tilts left, right |
| 57, 58 | head forward, back |
| 61, 62 | eyes turn left, right |
| 63, 64 | eyes up, eyes down |

Side matters. FACS writes **L** or **R** before an AU done on one side (R12 is a right-side smile) and **U** for unilateral. A one-sided AU is how contempt, a smirk or a wry doubt reads (chapter 8).

Source: AU names, muscles and the A to E scale as published in the FACS manual and widely reproduced. The table here is from the standard list; the manual itself is paywalled and was not read.

## 4. The eyes and brows first

The eye region carries most of what a viewer reads as feeling, so it is built and checked first. Its four parts are the upper lid, the lower lid, the brow and the gaze, and each has its own rules.

### The upper lid: how awake and how intense

At rest the upper lid covers the top 1 to 2 mm of the iris, and the lower lid sits at or just below the bottom of the iris (anatomy). Where the upper lid sits against the iris is the single strongest signal of energy.

| Upper lid | What it reads as | AU |
| --- | --- | --- |
| white visible above the iris | alarm, shock, rage, intense attention | 5 at C and up |
| just touching the top of the iris | alert, engaged | 5 at A or B |
| covering 1 to 2 mm of the iris | neutral, at ease | none |
| covering a third of the iris or more | tired, sad, bored, disdainful, sensual | 41 |
| covering the pupil | sleep, deep grief, pain, bliss | 42 or 43 |

The lid's highest point sits slightly toward the nose from the pupil's centre, and the lower lid's lowest point slightly toward the ear (anatomy). Lids drawn as even arcs centred on the pupil look manufactured.

### The lid follows the eye

When the eye looks down, the upper lid comes down with it; when it looks up, the lid rises. The lower lid follows less. This coupling is anatomy (the lid rides on the eyeball) and is the most often missing piece in game and VR faces. A figure that looks down at its hands with its lids still wide open looks like a doll. **Every figure needs a driver that moves the upper lid with vertical gaze** (chapter 11), added on top of whatever the expression asks for.

### The lower lid: joy or tension

Two different actions raise the lower lid, and they mean different things.

- **AU6, cheek raise.** The cheek pushes up from below. The lower lid bulges and curves, a bag forms under it and crow's feet fan out at the corner. This is felt joy, and also pain.
- **AU7, lid tightener.** The lid muscle itself straightens the lower lid and lifts it across the iris, with no bulge and no cheek movement. This is anger, concentration, suspicion and disgust.

Mixing these up is why a smile can look threatening: lower lids that straighten (AU7) instead of being pushed up from below (AU6).

### The brows: four basic shapes

| Brow shape | AUs | Reads as |
| --- | --- | --- |
| inner ends up, slanting toward the middle | 1, or 1 + 4 | sorrow, worry, pleading, grief (the oblique brow Darwin called the grief muscles) |
| whole brow up and arched | 1 + 2 | surprise, interest, disbelief, a question |
| down and together | 4 | anger, concentration, determination, distress |
| up and pulled together, flattened | 1 + 2 + 4 | fear, anxiety |

Brows move often in speech as punctuation: a lift on a stressed word, a lowering for doubt. A face that talks with still brows looks drugged.

### Gaze: attention made visible

- **Both eyes converge on what they look at.** For a near object the eyes turn in. Parallel eyes looking at a close face look vacant (measured: vergence).
- **Eyes jump, they do not glide.** Gaze moves in fast jumps called saccades, with still fixations between them. A saccade lasts roughly 20 to 200 ms and can reach several hundred degrees a second; a fixation typically lasts 200 to 400 ms (measured, the "main sequence"). Slow sliding eyes read as drugged or robotic.
- **Never perfectly still.** Between saccades the eyes drift and make tiny movements (microsaccades). A small jitter, well under a degree, keeps a held gaze alive (craft, from the measured effect).
- **Faces are read in a triangle.** When looking at someone, eyes move between the other person's two eyes and mouth (measured, eye-tracking studies).
- **Who looks at whom.** In conversation, listeners look at the speaker about 75% of the time and speakers look at the listener about 40% of the time, looking away while forming thoughts (Argyle and Cook, 1976).
- **Eyes lead the head.** For a turn of more than about 15 to 20 degrees, the eyes move first, the head follows, and the eyes counter-rotate as the head arrives so the gaze stays on target (measured: eye-head coordination). A large gaze shift is often accompanied by a blink (Evinger and colleagues, 1994).
- **Looking away has meanings.** Down for shame, embarrassment, sadness or submission; sideways or up while thinking or remembering; a quick glance away and back while lying is a myth, not evidence.

### Blinks

| Measure | Value | Source |
| --- | --- | --- |
| at rest | about 17 a minute | Bentivoglio and colleagues, 1997, 150 adults |
| talking | about 26 a minute | same |
| reading or concentrating | about 4.5 a minute | same |
| one blink, close to open | roughly 0.1 to 0.4 s | ranges across studies |

- **When to blink.** At pauses in speech, at the end of a thought, with a large gaze shift or head turn, and on a new emotion arriving. Not at random intervals: a fixed timer reads as mechanical.
- **Emotion changes the rate.** Stress and anxiety raise it; concentration and reading lower it; a long unblinking stare reads as threat or shock.
- **Shape and speed.** Studies disagree on whether closing or opening is faster. Animators' convention closes in about 2 to 3 frames at 30 frames a second and opens in 4 to 6, with the upper lid doing almost all the travel (craft). Disney Research measured real blinks and found the two eyes are not perfectly in step and the lid's speed changes through the blink, while animation tools usually play blinks symmetric and even ([Trutoiu and colleagues, Disney Research](https://la.disneyresearch.com/publication/modeling-and-animating-eye-blinks/)). Offset the two eyes by a frame or less and ease the lid.
- **Half blinks.** Not every blink closes fully. Mixing in partial blinks adds life.

### Wetness, light and pupils

Eyes look alive when they shine. Each eye needs a catchlight (a small bright reflection), a wet line along the lower lid edge and the pink inner corner. The cornea bulges in front of the iris, so the highlight sits proud of it. Pupils widen with arousal, interest and low light and narrow in bright light, over a fraction of a second to a second (measured); a slow widening during a moment of attraction or fear is one of the strongest small cues there is.

## 5. Cheeks, nose and mouth

The lower face carries the loudest signals but the least trusted ones, because people control their mouths more easily than their eyes. Built after the eyes, the mouth confirms what the eyes already say. Built alone, it reads as a mask.

### The smile family

The lip corner puller (AU12) is in every smile. What sits beside it decides which smile it is.

| Smile | AUs | What tells it apart | Reads as |
| --- | --- | --- | --- |
| Felt (Duchenne) | 6 + 12, often 25 | cheeks lift, crow's feet, lower lids pushed up from below; smooth onset and offset | real enjoyment |
| Social or polite | 12 alone | eyes unchanged; often slightly uneven; switches on and off too fast or holds too long | courtesy, compliance, hiding something |
| Held back (embarrassed) | 12 fought by 14, 23 or 24, with gaze down | lips press or tighten against the smile; head turns down or away | embarrassment, a smile you try not to show |
| Miserable | 12 with 1 + 4 brows, sometimes 15 | a smile under sad brows | putting a brave face on pain or loss |
| Contemptuous smirk | one-sided 12 and 14 | only one corner, tightened | superiority, scorn |
| Dominance | 12 with 9 or 10, uneven | nose wrinkle or upper lip raise in the smile | gloating, mockery |

Sources: the felt versus social distinction is Ekman, Davidson and Friesen (1990) and named after Duchenne de Boulogne's 1862 studies ([iMotions summary](https://imotions.com/blog/learning/research-fundamentals/duchenne-smile/)). The held-back smile is Keltner (1995). Reward, affiliation and dominance smiles were described by Rychlowska and colleagues (2017); the dominance row follows them as reported.

Two cautions. A strong AU12 on its own pushes the cheeks up and can fake a little AU6, and people can pose AU6 deliberately; so a cheek raise alone does not prove sincerity (measured, Krumhuber and Manstead, 2009). Timing is the better tell: felt smiles swell and fade smoothly, polite ones snap (chapter 9).

### Lip corners: four directions

| Corners move | AU | Reads as |
| --- | --- | --- |
| up and out, toward the ears | 12 | pleasure, warmth |
| straight back, lips flat | 20 | fear, strain, dread |
| down | 15 | sadness, disappointment, doubt |
| in, tightened, dimpled | 14 | restraint, smugness, contempt (one-sided) |

### The lips

- **Raised upper lip (AU10)** shows the upper teeth and deepens the top of the nasolabial fold: disgust and scorn.
- **Tightened lips (AU23)** go thin and hard at the red edge: anger, controlled effort.
- **Pressed lips (AU24)** bulge above and below: holding back words, laughter or tears, and determination.
- **Sucked-in lips (AU28)** roll over the teeth: fighting tears, nervousness.
- **Pushed-out lips (AU18, AU22)** pout or funnel: sulking, doubt, the shape of speech.
- **Lower lip down (AU16)** shows the lower teeth: anguish, disgust with fear, crying.

### The chin

The chin raiser (AU17) pushes the chin boss up, pouts the lower lip and dimples the skin. With the corners down (AU15) it is the face just before crying; a trembling chin is the strongest single sign that tears are coming. Sadness without AU17 often reads only as disappointment.

### Open mouths are three different things

| Action | AU | Feel |
| --- | --- | --- |
| lips part, jaw nearly closed | 25 | relaxed breathing, the start of speech, softness |
| jaw drops, slack | 26 | surprise, awe, stunned |
| mouth forced wide | 27 | scream, terror, a yawn |

Surprise has a slack, relaxed open mouth (26). Fear opens the mouth with the lips stretched tight (20 with 25 or 26). The same opening read with the wrong tension switches the emotion.

### Nose and cheeks

- **The nasolabial fold**, from the nostril wing to beyond the lip corner, is where the cheek's involvement shows. It deepens with AU10, 11, 12 and 13, and each pulls it into a different curve. A smile that leaves the fold flat looks painted on.
- **The nose wrinkler (AU9)** creases the bridge and pulls the inner brows down: disgust, and the nose half of a pain face.
- **Flared nostrils** come with heavy breathing, anger and effort.

## 6. The emotion recipes: the basic seven

Each basic emotion has a published set of action units that observers recognise across cultures. These are the starting recipes. They are prototypes, the clearest form of each face, and real faces mostly show parts of them (chapter 8).

| Emotion | Prototype AUs | Common partial forms | The one cue it cannot do without |
| --- | --- | --- | --- |
| Joy | 6 + 12 | 12, 6 + 12 + 25 | the cheek raise under the eyes (6) |
| Sadness | 1 + 4 + 15 + 17 | 1 + 4, 1 + 4 + 15, 6 + 15 | inner brows up and together (1 + 4) |
| Surprise | 1 + 2 + 5B + 26 | 1 + 2 + 5B, 1 + 2 + 26 | brows high, lids wide, jaw slack |
| Fear | 1 + 2 + 4 + 5 + 20 + 25 or 26 | 1 + 2 + 4, 1 + 2 + 4 + 5 | brows up yet pulled together (1 + 2 + 4) with lips stretched (20) |
| Anger | 4 + 5 + 7 + 23 | 4 + 5 + 7 + 24, 4 + 7, 17 + 24 | lowered brows over a hard stare (4 + 5 or 7) |
| Disgust | 9 + 15 + 16 | 9, 10, 10 + 17 | nose wrinkle or raised upper lip (9 or 10) |
| Contempt | R12A + R14A (one side) | one-sided 14 | only one lip corner tightens and lifts |

Source: the emotion prediction rules in the FACS Investigator's Guide (Ekman, Friesen and Hager, 2002), as reproduced in research tables; the guide itself was not read. Contempt is the most debated of the seven and the least reliably recognised.

### Joy

- **Eyes:** cheeks lift (6), lower lids pushed up into a gentle curve, crow's feet. The eyes narrow from below, never from above.
- **Mouth:** corners up and out (12), lips often parted (25), upper teeth showing at higher intensity.
- **Head and body:** head often tilts slightly up or to the side; laughter adds rhythmic jaw and breath.
- **Goes wrong when:** the eyes do not change, or the lower lids straighten (7) instead of bunching up, which turns it into a sneer.

### Sadness

- **Eyes:** inner brows up and together (1 + 4), which pinches the middle of the forehead into a short fold. Upper lids droop (41). Gaze drops.
- **Mouth:** corners down (15), chin pushed up (17), lower lip may pout or tremble.
- **Head and body:** head down, shoulders forward, breath slower with sighs.
- **Goes wrong when:** only the mouth turns down (it reads as sulking or doubt), or the brows lift as a whole (1 + 2) instead of at the inner ends, which reads as surprise.

### Surprise

- **Eyes:** brows raised high and arched (1 + 2), upper lids lifted (5B) so white shows above the iris.
- **Mouth:** jaw drops slack (26), lips relaxed, not stretched.
- **Timing:** the briefest emotion. It snaps on and gives way within about a second to whatever follows: joy, fear, confusion.
- **Goes wrong when:** held. A surprise held for three seconds reads as a pose, or as fear if any tension creeps in.

### Fear

- **Eyes:** brows raised and pulled together (1 + 2 + 4), which flattens them; upper lids lifted (5) and lower lids tensed (7); white shows above the iris.
- **Mouth:** lips stretched sideways (20), mouth open with tension (25 or 26, 27 for terror).
- **Head and body:** head pulls back or away, chin tucks, shoulders lift, the body freezes or withdraws.
- **Goes wrong when:** the brows are not drawn together. Without AU4 it is surprise.

### Anger

- **Eyes:** brows down and together (4), upper lids raised into a glare (5) while lower lids tighten (7). The eyes look hard and fixed.
- **Mouth:** either lips pressed (24) or lips tightened and parted, squared, showing teeth (23 with 10 and 25 or 26).
- **Head and body:** head forward and slightly down, chin forward, nostrils flared.
- **Goes wrong when:** the upper lids stay at rest. Brow lowering alone reads as concentration or puzzlement.

### Disgust

- **Eyes:** nose wrinkle (9) drags the inner brows down; lower lids rise; eyes narrow.
- **Mouth:** upper lip raised (10), lower lip down or pushed up (16 or 17), corners down (15).
- **Head and body:** head pulls back and turns away, as from a smell.
- **Goes wrong when:** confused with anger. Disgust is in the nose and upper lip; anger is in the brows and lids.

### Contempt

- **Face:** one lip corner tightens and lifts slightly (unilateral 12 and 14). Everything else stays calm.
- **Eyes and head:** often lids slightly lowered, head tilted back, gaze down the nose.
- **Goes wrong when:** made symmetric, which turns it into a polite smile, or made too strong, which turns it into a sneer of disgust.

## 7. The self-conscious and social emotions

The emotions the story needs most, shame, embarrassment, guilt, pride, longing and tenderness, are the ones with the thinnest research. Several have no reliable face at all. They are shown by **sequence, gaze, head and body**, and building them as a static face is the mistake. The table says how solid each recipe is.

| Emotion | Strength of evidence | Where it lives |
| --- | --- | --- |
| Embarrassment | measured, a distinct timed display | a held-back smile plus gaze and head down, in a sequence |
| Shame | measured, but as posture, not a face | head and gaze down, body shrinks, no smile |
| Guilt | no distinct display found | behaviour, not the face |
| Pride | measured, face plus posture | a small smile, head back, chest out |
| Pain | measured, a scored face | brows down, eyes squeezed, nose and lip raised |
| Confusion | measured, a frequent face | brows lowered and together, eyes narrowed |
| Awe | reported, a newer finding | brows up, eyes wide, jaw dropped, an intake of breath |
| Interest | reported, light | lifted brows or slight frown, fixed gaze, lean in |
| Tenderness, love | reported for behaviour, craft for the face | a soft smile, head tilt, soft gaze, lean in |
| Relief | craft | an exhale, a smile, shoulders drop |
| Longing | no research prototype | our choice, built from craft |

### Embarrassment

Keltner (1995) filmed people at the moment of embarrassment and found a display that unfolds in order over about five seconds. Compared with amusement, embarrassed people looked down faster and for longer, shifted gaze more, tried to control a smile, pressed their lips, turned the head away and down, and touched their faces ([paper](https://greatergood.berkeley.edu/dacherkeltner/docs/keltner.embarrassment.jpsp.1995.pdf); [course summary of its figure](https://psu.pb.unizin.org/psych425/chapter/facial-expressions-3/)).

1. **Gaze drops first**, fast (AU64). It lasts longest of all the parts.
2. **A smile starts and is fought** (AU12 against 24, 23, 14 or 15). The fight is the expression.
3. **The head turns away and down** (AU51 or 52 with 54), lagging the eyes.
4. **Gaze flicks** back up and away again, more than once.
5. **A hand may go to the face.** Skin may flush.

*Diagram in the live doc (https://claude.ai/code/artifact/ab111a4d-28c0-4c2e-a27e-8fc5d3669ebb): gaze drops from 0 to about 4.6 s; the smile from about 0.5 to 4 s; the lip press from about 0.7 to 4 s; head down and away from about 0.8 to 4.5 s; gaze flicks back up at about 2 s and 3.5 s.*

The smile and the lip press overlap: the fight between them is what viewers read as embarrassment.

The ADFES stimulus set codes posed embarrassment as AU12, 14, 23 or 24, 54 and 64. The approximate seconds in Keltner's figure have not been checked against the original and are given in Appendix A as a starting point.

### Shame

No published face prototype for shame exists, and that is the finding, not a gap in the search. Shame shows in the body: head down, gaze down, shoulders slumped, chest narrowed, and sometimes hands or arms covering the face. Keltner found that shamed people look down and away like embarrassed ones but **without the smile control**. Tracy and Matsumoto (2008) saw the same slumped, narrowed display in sighted and congenitally blind athletes after defeat, which suggests it is inborn ([ScienceDaily summary](https://sciencedaily.com/releases/2008/08/080811200018.htm)). Shame and submission have not been clearly separated.

To build shame (our choice from those findings):

- gaze down (64) and held, with few return glances;
- head down (54), slower than the gaze;
- a faint grief brow (1 + 4 at A or B) and drooped lids (41);
- lips pressed or sucked in (24 or 28), never a smile;
- the body shrinks: shoulders forward and in, chest narrowed, breath shallow;
- stillness: fewer movements of every kind.

### Guilt

Keltner and Buswell found no distinct facial display for guilt. Guilt is about a deed and a person, so it shows in behaviour: looking toward the one wronged and then away, reaching to repair. Build it as a gaze pattern on a sad base (1 + 4, light 15), with lip press (24), not as its own face (our choice).

### Pride

Tracy and colleagues found pride recognised across cultures: a small smile, the head tilted back a little (reported as about 20 degrees), the chest expanded, and arms raised or hands on hips. Winning athletes, blind and sighted, tilted the head up, smiled, raised their arms and pushed out the chest. The face alone is weak; **the head and chest carry it**.

- Face: 12 at B, little or no 6; eyes calm or slightly lowered lids.
- Head: up (53) and back. Body: chest out, shoulders back, wide stance.

### Pain

Pain has the best-measured face after the basic seven. The Prkachin and Solomon Pain Intensity score adds AU4 + the stronger of AU6 or 7 + the stronger of AU9 or 10 + AU43. The shared core is narrowed eyes. Strong pain adds the mouth stretched or open (20, 25, 26, 27). Recognising pain by AU43 alone is unreliable, because people faking pain close their eyes too.

### Confusion

Rozin and Cohen (2003) found confusion one of the most frequent faces in daily life: brows lowered and drawn together (4) and eyes narrowed (7), often with a head tilt and the mouth pulled to one side. It is close to concentration; the head tilt and lopsided mouth separate them.

### Awe

Reported as inner and outer brows raised (1 + 2), upper lids raised (5), jaw dropped (26), the head forward or up and a visible intake of breath (Shiota, Campos, Keltner and colleagues). Unlike surprise it is held and slow, with stillness.

### Interest

Light: brows slightly raised (1 + 2 at A) or a slight concentration frown (4 at A), lids slightly raised, gaze fixed, head tilted or forward, the body leaning in, lips sometimes parted (reported in the research on interest; mostly craft).

### Tenderness and love

Gonzaga and colleagues (2001) linked romantic love to felt smiles, head nods, forward leans and open gestures. The face itself is craft: a soft felt smile (12 at A or B with a trace of 6), lids slightly lowered, a head tilt, a soft gaze held on the other person with slow blinks, lips softly parted.

### Relief

Craft: a long exhale with the shoulders dropping, the head going back or down, lids lowering, then a smile (6 + 12) as the face loosens. The drop in tension carries it more than any one AU.

### Longing

No research prototype. Our choice, built from craft and the pieces above:

- a faint grief brow (1 at B, a trace of 4);
- the gaze soft and unfocused, slightly away or up, held;
- lids slightly lowered (41 at A);
- lips parted (25) or a faint, unfinished smile (12 at A) that fades;
- stillness, then a slow breath.

Treat longing, guilt, relief and tenderness as the places your eye decides. They are where the story lives and where the research ends.

## 8. Blends, masks and leaks

Real feeling is rarely one emotion at full strength. The richest faces are blends, faces fighting themselves, and small leaks of what someone is trying to hide. These are where a character becomes a person.

### Blends: one emotion per region

The simplest way to build a blend is to give each region a different emotion, as Ekman and Friesen showed in *Unmasking the Face* (1975). Du, Tao and Martinez (2014) later measured 21 "compound" expressions, such as happily surprised and sadly angry, and found each was made of the action units of its parts.

| Blend | Upper face | Lower face | Reads as |
| --- | --- | --- | --- |
| Bittersweet | sad brows (1 + 4) | soft smile (12 at B) | fond memory of a loss, a brave face |
| Happily surprised | brows up, lids wide (1 + 2 + 5) | broad smile, jaw open (12 + 25 or 26) | delight |
| Fearfully surprised | brows up and together (1 + 2 + 4), lids wide | lips stretched (20) | alarm |
| Sadly angry | brows down and together, inner ends up (1 + 4) with lids tight (7) | lips pressed, corners down (24 + 15) | hurt, betrayal |
| Gloating | brows down (4) | smile (12), often one-sided | cruel pleasure |
| Disgusted anger | brows down, glare (4 + 5) | upper lip raised (10) | revulsion at a person |
| Worried hope | inner brows up (1) | faint smile, lips pressed (12 at A + 24) | waiting for news |

### Upper face is honest, lower face performs

People control the mouth well and the brows and lids poorly. Ekman called the hard-to-fake actions "reliable muscles": the grief brow (1 + 4 with no 2) and the fear brow (1 + 2 + 4) are difficult for most people to make on purpose. So when the lower face says one thing and the upper face another, viewers believe the upper face. Use this deliberately: to show someone hiding sadness behind a smile, keep the grief brow and give the smile no cheek raise.

### Holding feeling back

Suppression has its own face: the effort shows.

- **Holding back tears:** lips pressed or sucked in (24 or 28), chin pushed up (17), quick blinks, gaze up or away, a swallow.
- **Holding back laughter:** lips pressed against the smile (24 against 12), cheeks lifting anyway (6), eyes down.
- **Holding back anger:** lips tightened (23), jaw clenched, nostrils flared, a held stare, very still.

### Asymmetry

- **Always a little.** Neutral faces are not symmetric. Give every expression a 5 to 15% difference in strength between left and right halves, and offset their timing by a frame or two (our choice, from craft).
- **Deliberate expressions are more lopsided.** Posed expressions tend to be more asymmetric than spontaneous ones (Ekman, Hager and Friesen, 1981). A strongly lopsided smile reads as put on or wry.
- **Some expressions are one-sided by nature:** contempt, the smirk, a raised brow of doubt (one-sided 2), a wink.

### Tells of sincerity

Viewers judge whether an expression is felt from these, roughly in this order of strength (craft built on the research above):

1. **Timing.** Smooth onset and offset; an apex that does not last too long. Snapping on and off, or holding a smile for many seconds, reads as fake.
2. **The reliable muscles.** The cheek raise in joy, the grief brow in sadness, the brow pull in fear.
3. **Agreement.** Face, gaze, head, body and voice say the same thing at the same moment.
4. **Symmetry.** Mild unevenness reads natural; strong unevenness reads posed or wry; perfect symmetry reads artificial.

### Leaks and micro-expressions

A hidden feeling can escape as a flash across the face before control returns. Ekman described micro-expressions as lasting about 1/25 to 1/5 of a second; later work by Yan and colleagues (2013) puts the upper limit nearer half a second. A flicker of contempt or fear under a polite face, one or two frames long, is a powerful storytelling tool and must be used sparingly (chapter 9).

## 9. Timing

The same face at the wrong speed is a different emotion, or no emotion. Every expression has an **onset** (rising in), an **apex** (at its height) and an **offset** (fading out), and each emotion has its own rhythm.

### How long expressions last

- **Ordinary expressions** last roughly half a second to four seconds (Ekman's description of macro-expressions).
- **Felt smiles** studied by Frank, Ekman and Friesen (1993) ran about 0.5 to 4 seconds with smooth, regular onsets. Smiles that were not felt were often shorter or much longer, with irregular timing.
- **Micro-expressions** last about 1/25 to 1/5 of a second, up to about half a second by later measures (chapter 8). At the Quest's 72 frames a second that is roughly 3 to 36 frames.

### Each emotion's rhythm (craft, consistent with the research above)

| Emotion | Onset | Apex | Offset |
| --- | --- | --- | --- |
| Surprise | very fast, a snap | very short, under a second | gives way quickly to the next feeling |
| Fear | fast | held while the threat lasts, with tension tremor | slow, wary |
| Anger | fast or building | held, very still | slow; the brows release last |
| Joy, felt | smooth swell | 0.5 to 4 s, alive with small changes | smooth, the eyes fade last |
| Joy, polite | abrupt | too short or too long | abrupt |
| Sadness | slow creep | long, drifting | very slow; the brows and lids linger |
| Disgust | fast, a recoil | short | moderate |
| Contempt | quick | brief | quick |
| Embarrassment | gaze first, then the fought smile, then the head | about 5 s in all | the gaze returns last |
| Shame | slow sinking | long and still | slow |

### The order of movement

1. **Eyes first.** Gaze and lids change first. The Pixar-style course this book draws on teaches that changes in the face lead the body's movement.
2. **Brows with or just after the eyes**, a few frames ahead of the mouth (craft).
3. **Then the mouth and jaw.**
4. **Then the head**, lagging the eyes (chapter 4).
5. **Then the shoulders, chest and breath.**

*Diagram in the live doc (https://claude.ai/code/artifact/ab111a4d-28c0-4c2e-a27e-8fc5d3669ebb): five staggered ramps, eyes and lids first, then brows, mouth and jaw, head, and shoulders and breath; each rises a little after the one above and lets go a little after it.*

Each part rises a little after the one above it and lets go a little after it, so the face never changes all at once.

### Moving holds: never still

A held expression must keep living or it becomes a mask (craft: Thomas and Johnston's moving hold).

- **Overshoot and settle.** Rise to about 5 to 10% past the target, then settle back over a few tenths of a second.
- **Drift.** Let each AU wander a few percent around its value, slowly, with the two sides drifting separately.
- **Keep the eyes going.** Small gaze shifts, saccades between targets, blinks at natural moments.
- **Breathe.** A slow rise and fall of the chest, nostrils and lips.

### Changing from one emotion to another

- **Do not cross-fade evenly.** One feeling fades as the next rises, often with a beat between them.
- **Change on a blink or a gaze shift.** The eyes close or move and the new face is there when they return (craft). It hides the changeover and reads as a thought.
- **The upper face changes first.** The brows and lids reach the new emotion before the mouth lets go of the old one, which is itself a leak.

### Comfort rule: no flashing

Your rule that nothing flashes applies to faces too. A micro-expression is a single flicker, never repeated quickly. A pulse or a laugh loop must not strobe the face or the light on it. The engine's Pulse already holds repeats to at most one a second.

## 10. Head, neck, breath and body

The face starts a feeling and the body finishes it. For pride, shame and embarrassment the body carries more than the face (chapter 7), and even the basic seven read far better with the head and breath agreeing.

| Posture | Reads as | Used in |
| --- | --- | --- |
| chin up, head back | pride, defiance, disdain | pride, contempt |
| chin down, head lowered | shame, sadness, submission, also menace when the eyes stay up | shame, sadness, anger (with the glare) |
| head turned away while the eyes stay | suspicion, coyness, distrust | embarrassment, flirting, doubt |
| head tilted to one side | interest, tenderness, a question, sympathy | interest, confusion, tenderness |
| head pulled back, chin tucked | fear, disgust, recoil | fear, disgust |
| head forward | anger, intense interest, threat | anger, interest |
| shoulders up and forward | fear, cold, shame | fear, shame |
| chest expanded, shoulders back | pride, confidence | pride |
| chest narrowed, shoulders slumped | shame, defeat, sadness | shame, sadness |

**The head-down glare.** Lowering the head while keeping the eyes on the target shows white under the iris and reads as menace. It is anger's most powerful pose and the same move as shame with one difference: where the eyes go.

**Breath** carries feeling between expressions.

- **Fast and shallow, high in the chest:** fear, excitement, anger building.
- **Slow and deep, with sighs:** sadness, relief, longing.
- **A held breath:** surprise, suspense, fear freezing.
- **A sharp intake:** surprise, awe, sudden pain.
- **A long exhale with the shoulders dropping:** relief, giving up.

Breath shows in the chest, shoulders, nostrils and lips together, not as a chest scale alone.

**Hands near the face** carry self-conscious feeling: touching the face in embarrassment, covering the face in shame, a hand to the mouth in shock, a hand to the chest in tenderness or hurt.

## 11. Building it into a figure

**Build one shape key per action unit and side, never one per emotion.** Emotions are then recipes: a weighted set of AU keys plus timing, gaze and head. This is how film and game face rigs work, and it is what makes faces reusable, blendable and checkable.

### Why per AU

- **Blends come free.** Bittersweet is the sad brow keys plus the smile keys, with no new sculpting.
- **Every face speaks the same language.** A recipe written for one figure works on any figure with the same AU keys.
- **The checker can name what is wrong.** "AU17 missing" can be fixed; "looks off" cannot.
- **Live performance can drive it.** Face tracking outputs AU-like values (below).

### The key set

1. **Split left and right** for every AU that can be one-sided: 1, 2, 4, 5, 6, 7, 9, 10, 12, 14, 15, 20 and the lids. Keep 17, 18, 22, 23, 24, 25, 26, 27 and 28 central, or split them later if needed.
2. **Sculpt each key at its maximum (E).** Weight 1.0 is the strongest the face can make. Intensities A to D are fractions of it (chapter 3, Appendix B).
3. **Sculpt the skin, not just the edges.** Move the volume that bunches (the cheek pad in AU6, the brow mass in AU4, the chin boss in AU17), and deepen the folds.
4. **Keep the eyeball out of every key.** Lid keys slide over the eye's surface and never cut into it.
5. **Add corrective keys for combinations that break.** Two keys added together can overshoot or intersect, for example the cheek and lower lid in 6 + 12, the forehead fold in 1 + 4, or lips with jaw open and smile together (26 + 12). A corrective key is sculpted on top of the pair and driven by the product of their weights (w₁ × w₂), so it only appears when both do (craft).

### The common names: ARKit 52 and MediaPipe

Apple's ARKit defines 52 face blendshape names (browInnerUp, cheekSquintLeft, mouthSmileLeft and so on) that most face tools now read and write. Google's MediaPipe Face Landmarker, free and open source under Apache 2.0, outputs those same 52 values from an ordinary webcam. So:

- **Name the keys with ARKit names where one exists** (Appendix B maps AU to ARKit), and keep FACS names for the AUs ARKit lacks (AU11, 13, 16 split, 17 partly, 23, 27, 41 to 44).
- **You can perform a face** in front of a webcam and drive a figure with MediaPipe's values: reference for every station, and a way to direct with your own face instead of words.

### Drivers every figure needs

These run every frame on top of whatever expression is playing (our choice of method; the behaviour is from chapters 4 and 9).

- **Lid follows gaze.** Upper lid closes as the eye looks down and opens as it looks up; lower lid follows less. Start with the upper lid moving about 0.6 of the eye's vertical turn and the lower lid about 0.2, then tune.
- **Blinks.** Timed by state (about 17 a minute at rest, 26 talking, 5 concentrating), triggered at speech pauses, gaze shifts over about 20 degrees and emotion changes, never on a fixed timer. Left and right lids offset by up to one frame; about one blink in five only partial.
- **Saccades and fixations.** Gaze jumps between targets with fixations of 200 to 400 ms, a tiny drift between jumps, both eyes converging on the target's real distance.
- **Eyes lead the head.** On a large turn the eyes go first, the head follows, and the eyes counter-turn to stay on target.
- **Breath.** A slow cycle on chest, shoulders, nostrils and lips, faster or slower with the emotion.

### Keeping the figure safe

- **Keys are offsets from the rest shape.** They never change the rest shape the bones are bound to, the skeleton or the skin weights. The sculpt engine already makes every stroke on a figure into a shape key, and its tests check that skeleton, weights and keys survive.
- **Weights stay between 0 and 1.** Overshoot (chapter 9) is a target, not a weight above 1.
- **Keys save as glTF morph targets**, which three.js, MakeHuman exports and the library all carry.

### A real limit in the Atelier's three.js

Three.js before release 133 draws at most 8 morph targets at once on a mesh, and only 4 when normals are morphed too (the Atelier runs release 128; the limit is in its source). A face recipe with left and right halves easily has 12 or more keys active at once, and three.js then silently drops the weakest. Two ways out:

1. **Combine on the CPU.** Each frame, sum the active AU keys into one "expression" offset and send that as a single morph target. A face of about 10,000 points with 12 active keys costs well under a millisecond, within the 72 fps budget.
2. **Move faces to three.js 133 or later**, which stores morph targets in a texture with no such limit. BSA already runs release 186.

Fixed on 14 October 2026 with the first way: scripts/sculpt_next_morphs.js. In a test on release 128, a face with 12 keys at 1 showed 8 before the fix and all 12 after. A face page calls keepAllKeys(THREE, figureRoot) once; the sculpt engine does it for its own figures and avatars.

## 12. The station workflow

Every expression at every station is built in the same order, top of the face down, then time, then life. Stop and check after each step; a later step never fixes an earlier one.

1. **Name the feeling and its moment.** One sentence: who feels what, about whom, and whether it is shown, fought or hidden ("she is embarrassed by the praise and tries not to smile"). Pick the recipe from chapters 6 and 7, or the blend from chapter 8.
2. **Get reference.** Make the face in a mirror or in front of a webcam with MediaPipe running, or find it in a free expression set (chapter 13). Never build from memory alone.
3. **Brows.** Set the brow shape (chapter 4). Check it alone with the rest of the face neutral: does it already hint at the feeling?
4. **Upper lids.** Set where the lid sits on the iris. Then look down and up and check the lid follows.
5. **Lower lids and cheeks.** Decide AU6 (pushed up from below) or AU7 (straightened), and set the cheek pad and the nasolabial fold.
6. **Gaze.** Where are the eyes looking, at what distance, and do they hold, avoid or search?
7. **Mouth.** Corners, lips, then chin (AU17 for sadness and fighting tears).
8. **Jaw.** Closed, lips parted (25), slack (26) or forced (27).
9. **Asymmetry.** Make the two halves differ by 5 to 15%; add one-sided actions where the feeling calls for them.
10. **Head, breath and body.** Chapter 10.
11. **Timing.** Onset, apex, offset from chapter 9 and Appendix A. Eyes first, mouth after, head after that.
12. **Life.** Moving hold, blinks at the right moments, saccades, breath. Play it for ten seconds and watch for the moment it turns into a mask.
13. **Check.** Run the rubric in chapter 13, and fix the earliest step that fails.

**Before handing a face on**

- [ ] The recipe and the AUs used are written down beside the face
- [ ] The eyes alone, with the mouth covered, read as the feeling
- [ ] The upper lid follows the gaze down and up
- [ ] The lower lid action is the right one (6 or 7)
- [ ] The two halves differ a little in strength and timing
- [ ] Nothing is held still for more than about a second
- [ ] Blinks fall at pauses, gaze shifts or changes, not on a timer
- [ ] Skeleton, skin weights and existing shape keys are unchanged
- [ ] No flashing: no flicker repeats faster than once a second
- [ ] Plays at 72 frames a second on the Quest, never below 20

## 13. Checking believability

A face passes when people who were not told the intended feeling name it, and when it stays alive for ten seconds without turning into a mask. The rubric below gives the blind checker named failures with a chapter to fix each, instead of a general "looks off".

### The rubric

Score each line 0 (fails), 1 (partly) or 2 (right). A face needs no 0 and at least 16 of 22 to pass (our choice; tune it as you use it).

| # | Check | A 0 looks like | Fix in |
| --- | --- | --- | --- |
| 1 | Mouth covered, do the eyes and brows alone read as the feeling? | flat or half-lidded eyes; the mouth does all the work | ch. 4 |
| 2 | Is the brow shape right for the emotion? | whole brow raised for sadness; no brow pull in fear | ch. 4, 6 |
| 3 | Is the upper lid at the right height on the iris? | wide eyes in sadness; lids at rest in anger | ch. 4 |
| 4 | Is the lower lid action right (pushed up from below or straightened)? | straightened lids in a smile, which reads as a sneer | ch. 4, 5 |
| 5 | Do the lids follow the gaze? | looking down with wide-open lids | ch. 4, 11 |
| 6 | Is the gaze directed, focused and converged? | staring past the target; parallel eyes on a near face | ch. 4 |
| 7 | Does the mouth agree with, or deliberately fight, the eyes? | a smile with no cheek raise when joy is meant | ch. 5, 8 |
| 8 | Is the face a little uneven? | perfectly mirrored, or lopsided when it should not be | ch. 8 |
| 9 | Is the timing right for this emotion? | a held surprise; a smile that snaps on and off | ch. 9 |
| 10 | Does it stay alive in a hold (drift, blinks, saccades, breath)? | a frozen face after a second | ch. 9, 11 |
| 11 | Do the head, breath and body finish it? | shame with an upright head and open chest | ch. 7, 10 |

### The blind naming test

Show the face, moving, to at least three people (or three fresh checker runs) without saying what it is meant to be. Ask: "What is this person feeling, and about what?" Two out of three naming it, or a close neighbour, passes (our choice). Keep their exact words: "sad" for an intended embarrassment says the smile control is missing.

### Reference you can use

- **Your own face.** A mirror, or a phone recording played back slowly, is the best reference there is and needs no licence.
- **[MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)** (Google, Apache 2.0). Free and open source. Reads 52 ARKit-named blendshape values from a webcam: a measured version of your face to compare a figure against.
- **Py-Feat** (MIT licence for the code). Detects action units and emotions from images and video. Its trained models carry their own licences; check each before use.
- **OpenFace 2.0** detects action-unit intensities well, but its licence is free only for academic, non-commercial use. It is not open source under your rules, so use it only to learn from, not in the apps.
- **Expression photo sets** such as [ADFES](https://aice.uva.nl/research-tools/adfes-stimulus-set/stimulus-set-contents) (which lists FACS codes for each face, including embarrassment, pride and contempt) and KDEF are free to request for research. They are for looking at, not for shipping in the apps.

### What the checker should write

Not "the face looks off" but: "Rubric 4 scores 0: the lower lids straighten (AU7) in the smile, so it reads as a sneer. Replace with AU6 at C." Every finding names the rubric line, the AU and the fix.

## Appendix A. Recipe cards

Every recipe as starting numbers for code. Weights run 0 to 1 against keys sculpted at maximum (A 0.15, B 0.35, C 0.55, D 0.8, E 1.0). The AUs come from chapters 6 and 7; **the weights and times are our choice**, starting points to tune by eye at each station. "L" or "R" marks a one-sided AU; otherwise give the two halves 5 to 15% difference. Head angles are degrees: down and up are pitch, turn is yaw, tilt is roll.

| Emotion | AU weights | Onset s | Apex s | Offset s | Head | Gaze and eyes |
| --- | --- | --- | --- | --- | --- | --- |
| Joy, felt | 6: 0.55, 12: 0.7, 25: 0.3 | 0.4 | 1.5 | 0.8 | up 3, tilt 4 | on the person; blink at onset |
| Joy, polite | 12: 0.45 | 0.12 | 1 to 5 | 0.15 | none | unchanged |
| Sadness | 1: 0.6, 4: 0.4, 15: 0.5, 17: 0.4, 41: 0.35 | 1.2 | 4 or more | 2.5 | down 8 | down 10, slow blinks |
| Surprise | 1: 0.7, 2: 0.7, 5: 0.4, 26: 0.5 | 0.1 | 0.6 | 0.5 | back 3 | fixed on the cause, no blink |
| Fear | 1: 0.6, 2: 0.5, 4: 0.4, 5: 0.6, 7: 0.2, 20: 0.5, 25: 0.4 | 0.15 | held | 1.0 | back 5, chin in | locked on the threat, darting |
| Anger | 4: 0.7, 5: 0.4, 7: 0.5, 23: 0.5 (or 24: 0.5 closed) | 0.3 | held | 1.5 | forward, down 5 | fixed glare, few blinks |
| Disgust | 9: 0.5, 10: 0.5, 15: 0.3, 17: 0.3 | 0.2 | 0.8 | 0.6 | back, turn away 8 | away from the cause |
| Contempt | R12: 0.25, R14: 0.35, 41: 0.15 | 0.2 | 0.7 | 0.4 | up 5, turn 5 | down the nose |
| Embarrassment | 12: 0.4 fought by 24: 0.4 (or 14: 0.35); 54, 64 | sequence | about 5 in all | sequence | down 10, turn 15, after the gaze | down 20 fast, flicks up twice |
| Shame | 1: 0.25, 4: 0.15, 41: 0.4, 24: 0.3; 54, 64 | 1.0 | long | slow | down 20, after the gaze | down 25 and held; few blinks |
| Pride | 12: 0.35, 6: 0.1 | 0.5 | 2 | 1.0 | up 12 (reported up to about 20) | level or down the nose |
| Pain | 4: 0.7, 7: 0.6 (or 6), 10: 0.5 (or 9), 43: 0.6, 20: 0.4, 25: 0.3 | 0.1 | while it lasts | 1.0 | down or turn away | squeezed shut, opening in pulses |
| Confusion | 4: 0.45, 7: 0.3, L12: 0.15 | 0.4 | 1.5 | 0.6 | tilt 10 | searching, short saccades |
| Awe | 1: 0.4, 2: 0.4, 5: 0.3, 26: 0.35 | 0.8 | long | 1.5 | up 5, forward | wide, still, slow blinks; breath in |
| Interest | 1: 0.15, 2: 0.15, 5: 0.15, 25: 0.15 | 0.4 | while it lasts | 0.8 | tilt 6, forward | fixed on the object |
| Tenderness | 12: 0.3, 6: 0.15, 41: 0.15, 25: 0.15 | 0.8 | long | 1.2 | tilt 8 | soft, held, slow blinks |
| Relief | 6: 0.4, 12: 0.5, 41: 0.3 after an exhale | 0.6 | 1.5 | 1.0 | back 5 then down | lids lower, close briefly |
| Longing | 1: 0.35, 4: 0.1, 41: 0.15, 25: 0.15, 12: 0.1 fading | 1.5 | long | 2.0 | still | soft focus, away 10 to 15, slightly up |

**Embarrassment, in order** (after Keltner's 1995 figure as summarised in a course text; the seconds are approximate and not checked against the paper):

| Time s | What happens |
| --- | --- |
| 0 to 0.3 | gaze drops fast (64) |
| 0.5 | a smile starts (12) |
| 0.7 | lips press against it (24) |
| 0.8 to 1.5 | head turns down and away (54 with 51 or 52) |
| about 2 and 3.5 | gaze flicks up and away again |
| 1 to 4 | the smile and the press fight |
| 4 to 5 | head returns, the smile fades, gaze comes up last |

## Appendix B. Lookup tables

### Action unit to ARKit blendshape

Use the ARKit name for the key where one exists, so MediaPipe and other tools drive it directly. Where ARKit has no match, keep a FACS-named key.

| AU | Name | ARKit blendshape | Note |
| --- | --- | --- | --- |
| 1 | Inner brow raiser | browInnerUp | ARKit has one for both sides; split it for asymmetry |
| 2 | Outer brow raiser | browOuterUpLeft, browOuterUpRight |  |
| 4 | Brow lowerer | browDownLeft, browDownRight |  |
| 5 | Upper lid raiser | eyeWideLeft, eyeWideRight |  |
| 6 | Cheek raiser | cheekSquintLeft, cheekSquintRight |  |
| 7 | Lid tightener | eyeSquintLeft, eyeSquintRight |  |
| 9 | Nose wrinkler | noseSneerLeft, noseSneerRight |  |
| 10 | Upper lip raiser | mouthUpperUpLeft, mouthUpperUpRight |  |
| 11 | Nasolabial deepener | none | FACS key au11 |
| 12 | Lip corner puller | mouthSmileLeft, mouthSmileRight |  |
| 13 | Cheek puffer | cheekPuff (partly) | FACS key au13 for the sharp corner pull |
| 14 | Dimpler | mouthDimpleLeft, mouthDimpleRight |  |
| 15 | Lip corner depressor | mouthFrownLeft, mouthFrownRight |  |
| 16 | Lower lip depressor | mouthLowerDownLeft, mouthLowerDownRight |  |
| 17 | Chin raiser | mouthShrugLower (with mouthShrugUpper) | the chin boss itself may need a FACS key |
| 18 | Lip pucker | mouthPucker |  |
| 20 | Lip stretcher | mouthStretchLeft, mouthStretchRight |  |
| 22 | Lip funneler | mouthFunnel |  |
| 23 | Lip tightener | none (mouthPress partly) | FACS key au23 |
| 24 | Lip pressor | mouthPressLeft, mouthPressRight |  |
| 25 | Lips part | none (small mouthLowerDown with jaw closed) | FACS key au25 |
| 26 | Jaw drop | jawOpen |  |
| 27 | Mouth stretch | jawOpen at full with mouthStretch | FACS key au27 for the forced shape |
| 28 | Lip suck | mouthRollLower, mouthRollUpper |  |
| 41, 42 | Lid droop, slit | eyeBlinkLeft, eyeBlinkRight, partial | a separate droop key reads better than a half blink |
| 43, 45, 46 | Closed, blink, wink | eyeBlinkLeft, eyeBlinkRight |  |
| 61 to 64 | Eyes left, right, up, down | eyeLookIn, eyeLookOut, eyeLookUp, eyeLookDown (each Left and Right) | drive the eye bones too, and the lid follow |
| none |  | jawForward, jawLeft, jawRight, mouthLeft, mouthRight, mouthClose, tongueOut | speech and asymmetry helpers |

### Numbers for the drivers

| Measure | Value | Kind |
| --- | --- | --- |
| Blinks at rest | about 17 a minute | measured (Bentivoglio, 1997) |
| Blinks while talking | about 26 a minute | measured (same) |
| Blinks while reading or concentrating | about 4.5 a minute | measured (same) |
| One blink, close to open | roughly 0.1 to 0.4 s | measured, studies vary |
| Blink shape | close in 2 to 3 frames, open in 4 to 6 (at 30 fps); one in five partial | craft |
| Left and right blink offset | up to one frame | our choice, after Disney Research |
| Saccade duration | roughly 20 to 200 ms, longer for bigger jumps | measured |
| Fixation between saccades | about 200 to 400 ms | measured |
| Eyes lead the head | on turns over about 15 to 20 degrees | measured |
| Upper lid at rest | covers the top 1 to 2 mm of the iris | anatomy |
| Upper lid follow | about 0.6 of the eye's vertical turn | our choice |
| Lower lid follow | about 0.2 of the eye's vertical turn | our choice |
| Left and right strength difference | 5 to 15% | our choice, from craft |
| Ordinary expression | about 0.5 to 4 s | measured (Ekman) |
| Felt smile | about 0.5 to 4 s, smooth onset | measured (Frank, Ekman and Friesen, 1993) |
| Micro-expression | about 1/25 to 1/5 s, up to about 0.5 s | measured (Ekman; Yan, 2013) |
| Overshoot before settling | 5 to 10% | craft |
| Listener looks at speaker | about 75% of the time | measured (Argyle and Cook, 1976) |
| Speaker looks at listener | about 40% of the time | measured (same) |

The intensity letters A to E and their starting weights are in chapter 3.

## Sources and further reading

The web pages could not be opened directly from this session (its network refused them), so the research findings were checked through search summaries of the papers. The books are paywalled and were not read. Each source says which.

| Source | What it gives | How it was used |
| --- | --- | --- |
| Ekman, Friesen and Hager, *Facial Action Coding System* manual and Investigator's Guide (2002) | the action units, A to E scale, emotion prediction rules | not read; standard tables as widely reproduced; emotion rules checked against a research table in a search summary |
| Ekman and Friesen, *Unmasking the Face* (1975) | blends by face region, masking | not read; known content |
| [Faigin, *The Artist's Complete Guide to Facial Expression*](https://www.randomhousebooks.com/books/47714/WG) | muscles, folds and expressions for artists | not read; known content |
| [Osipa, *Stop Staring: Facial Modeling and Animation Done Right*](https://www.tenlong.com.tw/products/9780471789208) | building face rigs, eyes and brows | not read; table of contents |
| Thomas and Johnston, *The Illusion of Life* (1981) | moving holds, overlap, timing | not read; known content |
| [Keltner, "Signs of appeasement" (1995)](https://greatergood.berkeley.edu/dacherkeltner/docs/keltner.embarrassment.jpsp.1995.pdf) | the embarrassment display and its sequence; shame without smile control | search summary of the paper and of a [course chapter reproducing its figure](https://psu.pb.unizin.org/psych425/chapter/facial-expressions-3/) |
| [Keltner and Buswell (1997)](https://greatergood.berkeley.edu/dacherkeltner/docs/keltner.buswell.psychbull.1997.pdf) | embarrassment distinct from shame, guilt and amusement | search summary |
| [Tracy and Matsumoto (2008)](https://sciencedaily.com/releases/2008/08/080811200018.htm) | pride and shame displays in blind and sighted athletes | search summary; [National Geographic report](https://www.nationalgeographic.com/science/phenomena/2008/08/13/blind-olympic-athletes-show-the-universal-nature-of-pride-and-shame) |
| Tracy and Robins (2004) | the pride expression, head tilted back | not read; the 20-degree figure is as commonly reported and unverified |
| [Bentivoglio and colleagues (1997)](https://wicri-demo.istex.fr/Wicri/Sante/explor/MovDisordV3/Site/fr/Main/Exploration/bibRecord.php?hk=005409) | blink rates at rest, talking and reading | search summary |
| [Trutoiu and colleagues, Disney Research, "Modeling and animating eye blinks"](https://la.disneyresearch.com/publication/modeling-and-animating-eye-blinks/) | real blinks are uneven and asymmetric | not opened; reported finding |
| Prkachin and Solomon (2008) | the pain intensity score | search summaries ([review](https://arxiv.org/pdf/1811.07988)) |
| Ekman, Davidson and Friesen (1990); [iMotions on the Duchenne smile](https://imotions.com/blog/learning/research-fundamentals/duchenne-smile/) | felt versus social smiles | known content |
| Frank, Ekman and Friesen (1993) | felt smile durations and smoothness | known content |
| Krumhuber and Manstead (2009) | the cheek raise can be posed | known content |
| Rychlowska and colleagues (2017) | reward, affiliation and dominance smiles | known content, as reported |
| Du, Tao and Martinez (2014) | 21 compound expressions | known content |
| Ekman, Hager and Friesen (1981) | posed expressions more asymmetric | known content |
| Rozin and Cohen (2003) | confusion and concentration faces | known content |
| Gonzaga and colleagues (2001) | behaviours of romantic love | known content |
| Shiota, Campos, Keltner and colleagues | the awe display | known content, as reported |
| Yan and colleagues (2013) | micro-expression durations up to about 0.5 s | known content |
| Argyle and Cook (1976) | gaze while speaking and listening | known content |
| Evinger and colleagues (1994) | blinks with large gaze shifts | known content |
| [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) | 52 blendshape values from a webcam, Apache 2.0 | known content |
| three.js release 128 source, WebGLMorphtargets.js | the limit of 8 morph targets drawn at once | read directly in this project's copy |
| [ADFES stimulus set](https://aice.uva.nl/research-tools/adfes-stimulus-set/stimulus-set-contents) | FACS codes for posed faces, including embarrassment | via the earlier lane's report |
| [Gnomon Workshop, Facial Animation for Feature Animated Films](https://thegnomonworkshop.com/workshops/facial-animation-for-feature-animated-films) | the "Pixar-style" course: eyes lead, asymmetry | via the earlier lane's report |

**Worth buying first**, if a human reads them: Faigin for the look of every expression, Osipa for building the rig, and the FACS manual for the exact rules.
