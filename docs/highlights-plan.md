# Highlights: game and season reels (plan)

Planned 2026-11-01. **Built 2026-11-02** (code in `src/highlights/`), using the recommended answer to each decision:
shared with the staff plus a local library, video work in the browser, FCPXML by default, number + first name on
screen, and reels in the app first.

- **Built:** phases 1–4. That's the section, ★ Highlight / H in the Film Room, suggestions, Field extras, the clip bin, the trim editor
  (snap, slow motion, freeze + spotlight, camera replay), game / season / player / custom reels, the reel player, the
  every-kid check, settings, this-computer-only mode, the local library with `highlights.json`, and exports (FCPXML, FCP7
  XML, EDL, OTIO, cut list, YouTube chapters, PNG graphics) with linked film, copied clips, or trimmed H.264 copies
  (Mediabunny).
- **Not built yet:**
  - Make video (a finished MP4 rendered in the app).
  - Music in the exported timeline (add the song in Resolve).
  - Reels on the TV second screen (full screen on a TV hooked to the computer works).
  - The local ffmpeg helper.
- **Still needed:** the Resolve test below, on real film.

A new **Highlights** section for game reels, an end-of-season reel and a reel for every kid. Coaches mark plays while
watching film, the app suggests the big plays from the breakdown, and the Field camera's extra clips (celebrations,
the sideline) come along too. Each highlight is trimmed, titled and put in order. A reel can play right in the app
for a team meeting or the banquet, or go out as a timeline file for DaVinci Resolve, Premiere or Final Cut. A
**local library** on your computer holds the trimmed clips and the project, so the heavy video work stays off the
cloud.

The original film is never changed. A trim is just a start and end time until a coach asks for files.

## How it works for the coach

### Collecting highlights

- **★ Highlight** in the Film Room's bottom bar, or the **H** key, marks the play on screen. A small card opens with
  quick tags; the players are filled in from the breakdown (who carried, threw, caught, tackled). It closes on its own
  if you keep watching.
- **Suggestions from the breakdown:** a "Suggested" list for each game with every touchdown, explosive play,
  gain of 15+ yards, sack, interception, forced fumble, fumble recovery, tackle for loss, pass breakup and long kick
  return. One tap keeps it, one tap skips it. The rules and the yardage are options.
- **Field extras:** every Field clip marked "Not a play" (Extra · highlights) shows up as an **Extra**, labeled with
  where it falls ("between plays #12 and #13, 2nd quarter") so it's easy to find. Tag it: celebration, sideline,
  huddle, coin toss, warm-ups, crowd, trophy.
- **From Player Finder:** "Add to highlights" on any play in a kid's season list.

### Trimming

- **A good start without touching it:** each highlight starts 2 seconds before the snap and ends 6.5 seconds
  after it, the same window as Fast Cut (the app already finds the snap). If the snap can't be found, it uses the
  whole clip.
- **Trim editor:** a filmstrip with start and end handles, frame steps, **I** / **O** to set start and end at the
  playhead, and a loop of just the trimmed part.
- **Angle:** Main, Field, or **Main, then a Field replay**. The two cameras are already lined up by the Both views
  sync, so the replay starts at the same moment.
- **Slow motion** over part of the play (½ or ¼ speed), a **freeze frame** with a **spotlight** ring or arrow on a
  kid, and a **zoom** (the Player Cam plan's follow camera plugs in here later).

### Reels

- **Game reel:** one per game, in game order. It starts from the game's kept highlights and suggestions.
- **Season reel:** the best of every game, in season order, by category, or as a Top 10 countdown. There's a
  chapter card for each game with its score.
- **Player reels:** built for you from every highlight tagged with a kid's number, with a stats card from Player
  Finder's totals (carries, yards, touchdowns, tackles, sacks).
- **Custom reels:** "Defense", "O-line pancakes", "Special teams": filter the clip bin, add, drag to reorder.
- **Every kid in it:** a banquet check that lists any kid on the roster with fewer than N highlights, with a link
  to his plays in Player Finder to pick more.

### Watching a reel in the app

A reel plays in the app with its trims, titles, slow motion, freezes and replays, with no rendering. It also
plays full screen and on the TV through the Film Room's second screen. That covers Sunday's team meeting, and the
banquet can run straight from the app.

### The Highlights screen

```
┌ Highlights ──────────────────────────────────────────────────────────────┐
│ [Clips] [Game reels] [Season reel] [Player reels] [Export]   Settings ⚙ │
├──────────────────────┬───────────────────────────────────────────────────┤
│ Filters              │  Video (trimmed part loops)                       │
│  Game  Week 3 ▾      │  ──────[====start=========end====]─────────────── │
│  Kind  TD · Big gain │  Angle: Main ▸ Field replay   Slow-mo ½ 3.2–5.0s  │
│  Kid   #7 ▾          │  Title: "#7 · 45-yd TD run"   ★★★                 │
│  ★ 2+  Extras ☐      ├───────────────────────────────────────────────────┤
│ 38 clips · 4:12      │  Reel: Week 3 vs Shrub Oak   12 clips · 1:58      │
│  ▸ #12 45-yd TD ★★★  │   1 Intro card  2 #3 KO return  3 #12 TD  …       │
└──────────────────────┴───────────────────────────────────────────────────┘
```

## The options

Every setting below has a default, so a reel works with no choices made. Defaults are set once in Settings and can be
changed per reel or per highlight.

### Each highlight

| Option | Choices | Default |
| --- | --- | --- |
| Start / end | handles, I / O keys, frame steps | snap − 2 s to snap + 6.5 s |
| Angle | Main · Field · Main then Field replay · Field then Main | Main |
| Replay | speed (full, ½, ¼), how much of the play | ½ speed, snap to end |
| Slow motion | a part of the play at ½ or ¼ | off |
| Freeze frame | where, how long (1–4 s) | off |
| Spotlight | ring · arrow · glow · name tag, on the freeze | ring |
| Zoom | 1×–3×, where | off |
| Title | written for you ("#7 · 45-yd TD run"), editable | on |
| Category | TD, big run, catch, sack, INT, fumble, TFL, PBU, block, kick, extra | from the breakdown |
| Kids | jersey numbers (several) | from the breakdown |
| Rating | ★ to ★★★ | ★ |
| Note | free text, also goes into the export as a marker | blank |

### Each reel

| Option | Choices | Default |
| --- | --- | --- |
| Kind | game · season · player · custom | |
| Order | game order · by category · by rating · Top 10 countdown · by hand | game order |
| Length goal | none, or a target (60 s, 3 min, 5 min) with a running total | none |
| Intro card | team, opponent, date, final score, season record | on |
| Game chapter cards | season reel only | on |
| Lower third | down & distance, quarter, result, the kid | result + kid |
| Score bug | small score / quarter in a corner | off |
| Stats card | player reels | on |
| Outro card | final score · "Next: Week 5 vs …" · thanks · team photo | final score |
| Between clips | cut · quick dip to black · crossfade | cut |
| Replays | per highlight · all on · all off | per highlight |

### Look

| Option | Choices | Default |
| --- | --- | --- |
| Colors | team colors (Mahopac blue and gold) or any | team colors |
| Logo | a PNG you add, corner position, size | none |
| Font | 4–5 bold sports fonts | the first |
| Title style | bar · box · plain text · broadcast strip | bar |
| Names on screen | number + first name · number + full name · number only · none | number + first name |

### Sound

| Option | Choices | Default |
| --- | --- | --- |
| Game sound | on · lower under music · off | lower under music |
| Music | your own files, one per reel or per chapter, start offset, fade out | none |
| Whistle cut | end each clip at the whistle sound (later) | off |

### Output

| Option | Choices | Default |
| --- | --- | --- |
| Shape | 16:9 · 9:16 vertical (Instagram, TikTok) · 1:1 | 16:9 |
| Size | 4K · 1080p · 720p | 1080p |
| Frame rate | 30 (smooth ½-speed slow motion from the 60 fps camera) · 60 | 30 |
| Presets | Banquet · Parents (small file) · Social (vertical, 60 s) · For Resolve | |

### Who and where

| Option | Choices | Default |
| --- | --- | --- |
| Saved | shared with the staff · this computer only (local library) | see decision 1 |
| Who can add highlights | every coach · owner only | every coach |
| Who sees a reel | me · chosen coaches · whole staff (like playlists) | whole staff |

## The local library ("local database")

A folder you pick once on the editing computer, for example `J:\Mahopac Highlights`. The app keeps its highlight
database there along with everything the video work makes, so Resolve and Windows Explorer see the same files:

```
Mahopac Highlights\
  highlights.json            the database: every highlight, trim, tag and reel (a backup the app can read back)
  2026 10U\
    Week 3 - Shrub Oak\
      Clips\                 trimmed copies (only when asked for)
      Graphics\              title cards, lower thirds, spotlights (PNG)
      Week 3 - Shrub Oak.fcpxml
      Read me - Resolve.txt
    Season\ ...
    Players\ #7\ ...
  Music\                     drop music files here; they show up in the Music list
```

- **This computer only:** with the local mode on, highlights are saved in the browser's own database
  (IndexedDB, the same place the app keeps big Hudl data) plus `highlights.json`, and nothing goes to the cloud.
  It works offline.
- **Shared, plus the library (recommended):** the highlight list and the trims are tiny (about 300 highlights in a
  season is about 120 KB), so they're shared with the staff like notes and playlists. Every coach can mark plays
  from an iPad. The video files are made only in the library on the editing computer.
- **Backup:** `highlights.json` is the full list. Copy the folder and the season is safe.

### Three ways to do the video work

1. **In the browser (recommended to start).** No install. On the live site in Chrome or Edge, the app reads the
   film from your film folder and uses your graphics card's video chip to trim and convert. Copy trims (no quality
   loss) start at the nearest key frame, usually less than a second early, which is fine because each copy keeps a
   little extra on both ends. Exact frame cuts, slow motion baked in, or a different size mean re-encoding: slower,
   though it should still beat real time on your RTX 3080.
2. **A local helper (only if 1 is too slow).** The app's own server, which already runs on your PC with
   `npm run localhost`, gets a small highlights route with real ffmpeg. That's the fastest and handles any camera
   file, and it could batch a whole season overnight. It only works on that PC, and only while it's running.
3. **No files at all.** Export only the timeline file and let Resolve cut the original 4K film. That gives the best
   quality, takes zero disk space, and nothing gets re-encoded. It's also the first export to build.

## Export to DaVinci Resolve and other editors

An **Export** button on every reel writes a timeline file and the pictures it uses. In Resolve you use
**File › Import › Timeline**, pick the file, and the reel shows up in order, already trimmed.

| Format | For | What carries over |
| --- | --- | --- |
| **FCPXML** (default) | Resolve, Final Cut Pro | cuts, clip names, slow motion, freezes, markers, graphics on a second track |
| FCP7 XML | Premiere Pro, Resolve | the same; the most widely read |
| EDL | any editor | cuts in order, clip names, simple speed changes; one video track |
| OTIO | Resolve, newer tools | an open format, kept as an option |
| Cut list (CSV) | a spreadsheet, a coach without an editor | every clip, start/end, title, kids |
| YouTube chapters | the description box | "0:00 Intro, 0:12 Week 1 vs Suffern, …" |

- **Markers:** each highlight gets a marker with its title, category, kids and note, so you can jump between plays
  in Resolve.
- **Titles and spotlights:** by default these are pictures (PNG with see-through backgrounds) on track 2, so they
  look exactly like the app's preview in every editor. The other choice is editable Resolve text: you can change
  the words there, but the style is plainer.
- **Slow motion:** with the 60 fps camera on a 30 fps timeline, ½ speed shows every real frame, so it's smooth
  without Resolve guessing frames in between.
- **Where the film is:** the browser can't see drive letters. The first export asks once, "Where is Mahopac Film on
  this computer?" (`J:\Mahopac Film`), and remembers it on that computer. The rest of each path is known from the
  folder layout (`10U\Week 3 - Shrub Oak\Main\…`). Film that's only on Google Drive can point at Google Drive for
  desktop (`G:\My Drive\Film Room 4K\Mahopac Film`), or be downloaded into the library first. If Resolve still
  says "Media Offline", its Relink button pointed at the folder fixes it; the read-me file says how.
- **Packaging, three choices:**
  - **Link the originals** (default): no copies. This works on your computer only.
  - **Trimmed copies with handles:** a self-contained folder you can hand to anyone who edits.
  - **Resolve-ready copies:** trimmed and converted to 8-bit H.264, in case free Resolve won't play the camera's
    10-bit HEVC. See "Needed before building".

## A finished video without an editor

**Make video** renders the reel to an MP4 in the browser: titles, slow motion, freezes, replays, music, 16:9 or
vertical. It saves to the library, or to a "Highlights" folder in the team's Google Drive to share with parents.
It comes last because it's the most work, and Resolve covers the same ground sooner.

## How it's built

- **New folder `src/highlights/`:**
  - `types.ts`: `Highlight` (game, play or Field extra, view, clip, start/end, angle and replay, slow-mo, freeze,
    spotlight, title, category, kids, rating, note, who/when) and `Reel` (kind, items in order with per-reel
    changes, options, owner, sharing).
  - `highlightStore.ts`: one shared doc per team per season (`teamData/filmroom_<team>_highlights_<season>`), merged
    record by record with tombstones (`mergeById` / `mergeTombstones`), the same way `useFilmLists` does playlists.
    Highlights belong to one team, like everything else (team isolation).
  - `localLibrary.ts`: the library folder (asked with write permission, handle kept in the Film Room's IndexedDB),
    `highlights.json`, and local-only mode.
  - `suggest.ts`: the suggestion rules, read from the play's `result`, `isExplosive`, `gainLoss`,
    `defPlay.events` (sack, tfl, int, ff, fr, pbu) and kick types. Players come from `rusher` / `passer` /
    `receiver` / `defPlay.maker`, through `playerPlays.ts`.
  - `trim.ts`: default windows from `probeSnap` / `snapTimeCache`; replay timing from the Both views offsets
    (`dualView.ts`).
  - Exporters (plain functions, tested against saved files): `exportFcpxml.ts`, `exportXmeml.ts`,
    `exportEdl.ts`, `exportOtio.ts`, `exportCsv.ts`.
  - `graphics.ts`: title cards, lower thirds, score bug and spotlights drawn on a canvas, then saved as PNG. The
    preview and the export use the same drawing.
  - `cutter.ts`: copy trims and conversions with **Mediabunny** (a browser media library built on the browser's
    video encoder and decoder). Its simple trim re-encodes whenever the start isn't 0, so copy trims will use its
    packet reader and writer, starting at the key frame before the cut. A short test proves this first; ffmpeg in
    the browser is the fallback.
  - `render.ts` (last phase): the finished MP4.
- **Screens:** `HighlightsView.tsx` (the section), `ClipBin.tsx`, `TrimEditor.tsx`, `ReelBuilder.tsx`,
  `ReelPlayer.tsx`, `ExportDialog.tsx`, `HighlightSettings.tsx`.
- **Also touched:**
  - `SidebarNavigation.tsx` / `MobileNavigationModal.tsx`: a "Highlights" entry under Film Room.
  - `FilmPlayer.tsx` / `FilmRoomView.tsx`: ★ Highlight and the H key.
  - `PlayerFinder.tsx`: Add to highlights.
  - `ViewLineup.tsx`: extras link to the bin.
  - The TV second screen (`screenLink.ts` / `VideoScreen.tsx`) plays reels.
- **Tests:** the exporters, suggestion rules, trim defaults and merging get tests in the usual way. The screens are
  tested in the isolated page with ffmpeg-made clips (no database). One sample export made from test clips gets
  opened in your Resolve to prove the import before real film.

## Build order

1. **Collect, trim and play.** The section, ★ Highlight, suggestions, Field extras, the clip bin with filters,
   the trim editor, game reels, and reels playing in the app and on the TV. Saved and shared.
2. **Export to Resolve.** FCPXML plus EDL and the cut list, PNG graphics, markers, the film-folder question, and
   the read-me.
3. **Local library.** The folder, local-only mode, `highlights.json`, trimmed copies, Resolve-ready copies.
4. **Season and player reels.** Built automatically, the every-kid check, stats cards, Field replays, spotlights,
   vertical shape.
5. **Make video.** The finished MP4 with music, saved to the library or Drive.
6. **Local helper,** only if the browser is too slow on real 4K film.

## Limits

- **Free Resolve and your camera's files:** reports disagree on whether free Resolve on Windows plays 10-bit HEVC
  (what the Main camera records). Studio does. The test below settles it, and Resolve-ready copies cover a "no".
- **Computer vs iPad:** marking, trimming, building reels and watching them work everywhere, iPad included. The
  local library, exports and Make video need Chrome or Edge on a computer.
- **Copy trims** start at a key frame (up to about a second early). Exact cuts need re-encoding or Resolve.
- **iPhone film** can have an uneven frame rate. Resolve handles it, but slow motion on those clips is less smooth.
- **Music:** reels shared online need music you're allowed to use. The app doesn't supply any.
- **Kids' privacy:** reels stay with the staff; files leave only when a coach exports or shares them. Names on screen
  are an option (decision 4).

## Needed before building

- **A two-minute Resolve test:** drag one Main-camera clip (for example from `J:\Mahopac Film\10U\Week 3 - Shrub Oak`)
  into a new Resolve project. Does it play smoothly, play choppily, or show "Media Offline"? Also, is your Resolve free or
  Studio, and which version?
- **Five decisions** (recommendation first in each):
  1. **Where highlights are saved:** **shared with the staff, video files in the local library** (any coach can
     mark plays from an iPad), or this computer only?
  2. **Video work:** **in the browser first, the local helper only if it's too slow**, or build the helper first?
  3. **Default export:** **FCPXML** (Resolve), with EDL and FCP7 XML one click away?
  4. **Names on screen:** **number + first name** by default, with full name / number only / none as options?
  5. **Order:** start with **phase 1 (reels in the app)**, or jump to the Resolve export first because the banquet
     reel is the priority?
