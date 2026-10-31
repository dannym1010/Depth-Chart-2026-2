# Player Cam: pick a player and the film follows him (plan)

Planned 2026-10-31. Status: **not started**. Waiting on a few game clips to tune tracking and on the four decisions at the bottom.

Pick a player and the film zooms in on him, then follows him through the play like a TV iso camera.

## How it works for the coach

- **Pick him**, best when paused at the snap. Three ways:
  - Tap **Follow** in the film's bottom bar, then tap the player.
  - With Play lines on, tap his ring and choose **Follow him**.
  - In a presentation, use a Follow button in the full-screen controls.
- **Choose the zoom:** a quick 2×, 3× or 4×, or any amount in between, plus how much room to leave ahead of him in the direction he's running. It remembers the choice.
- **First time on a clip:** the clip plays at half speed while it locks on and follows him, so the coach watches it work. If it loses him in a pile-up, it pauses and says "Tap #3"; one tap and it carries on. It never quietly starts following the wrong kid.
- **After that**, the follow is saved with the play for every coach. It plays at full speed with a smooth camera, and he stays slightly behind center like on TV.
- **Fix it by hand any time:** scrub to a moment and drag the view onto him. Or use **Follow by finger**: the clip plays at ¼ speed while you keep a finger or the Pencil on him, and that becomes the path.
- **Whole-field inset:** a small picture-in-picture of the full frame in a corner, with a box showing where you're zoomed. A button turns it off.

## How it's built

- **Follow camera** (FilmPlayer): the film already has zoom and pan, so following him is a matter of steering them. Each video frame, the view eases toward his spot on a smooth, slightly springy path and never leaves the picture. Drawings ride along with the zoom. The path smoothing and camera math go in a new `src/filmroom/followCam.ts`, with tests.
- **Tracking** (`src/filmroom/playerTracker.ts`), done on the iPad itself; nothing is uploaded:
  - **Lock on:** the tap gives a point. His outline comes from what isn't grass, and the field lineup tells it how big a player is at that spot.
  - **Follow:** each frame it searches a small area around where he's headed, on a shrunken copy of the frame (about 400 px wide) so it stays quick.
  - **When it's unsure:** if the match gets weak (crossing a teammate, bodies piling up), it stops and asks for a tap.
  - **If that isn't good enough** on real film, the next step up is a small person-detection model (MediaPipe) on the iPad's graphics chip. The way the coach uses it stays the same.
- **Saving:** a new `follows` section in each game's shared film data (`FilmGameShared` in `src/filmroom/types.ts`), next to `drawings`. Each play keeps who was followed (tag and jersey number), his path, the zoom, and who made it and when. If two coaches change the same one, the newer change wins, the same rule `mergeShared` uses for drawings. Each path is a few KB.
- **Also touched:**
  - `PlayLinesOverlay.tsx`: Follow him on a tapped player
  - the presentation's full-screen controls (`ScoutPresentation.tsx`): a Follow button
  - `PlayerFinder.tsx`: the player cam cut-up (step 3)

## Build order

1. **Follow camera, Follow by finger, hand fixes, and saving/sharing.** Works on any film right away, with no tracking risk.
2. **Automatic follow with tap-to-fix,** tuned on real clips.
3. **Polish:**
   - the presentation Follow button and the whole-field inset
   - the diagram: Run with a player picked zooms in and follows his route, using the presenting zoom (`presentZoom` in `PlayDiagramCanvas.tsx`)
   - a "player cam" cut-up in Player Finder: every snap of #21 this season, each one following him

## Limits

- Youth film is hard to track automatically: same jerseys bunched together, pile-ups, and far-off kids only a few pixels tall. Expect it to ask for a tap now and then.
- Zoom sharpness depends on the camera. 1080p and 4K hold up to about 3×; 720p gets soft past 2×.
- If the camera operator whip-pans to follow the ball, tracking may need a tap.

## Needed before building

- **2–3 real game clips** to tune tracking: a sweep, a pass, and a crowded inside run, in a folder such as `Downloads\follow-test`. They'd only be used on this computer.
- **Four decisions** (recommendation first in each):
  1. Should saved follows be shared with all coaches? **Yes**, like drawings.
  2. Default zoom: **2.5× with lead room**, changeable.
  3. Play lines while following: **hide them**, since they don't zoom with the video, or make them zoom with it in follow mode only?
  4. Build **step 1 first** so it's ready sooner, or steps 1 and 2 together?
