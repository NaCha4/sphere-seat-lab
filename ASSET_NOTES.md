# Screen content — Research 10

All three worlds offer a shared video selector. **Chromatic Flux** remains the default, unchanged: a self-authored procedural motion graphic with rotating neon orbits, flowing contours and expanding rings. It has a continuous 20-second loop with no cuts, audio, external footage or images. This is presentation content, not evidence of reduced motion sickness.

| World | Video | Dimensions |
| --- | --- | --- |
| Original / V1 | `public/media/sphere-motion-loop.mp4` | 2048×1024, full-sphere equirectangular |
| V2 | `public/media/sphere-motion-two-bands.mp4` | 3072×1432, synchronized two-strip atlas |

Both are 24 fps / 480 frames, H.264 High, yuv420p, silent, looping, with fast-start metadata. Posters have the same base name and `.jpg` extension. Separate current V2 exports are `sphere-motion-zone-1.mp4` (3072×588) and `sphere-motion-zone-2.mp4` (3072×844). Old three-band files are retained as previous exports and are no longer selected by the app.

`python scripts/generate-motion-video.py --ffmpeg /path/to/ffmpeg` reproduces all outputs using NumPy, Pillow and an ffmpeg binary with libx264. `--target sphere` renders the source; `--target bands` derives the atlas from the existing source. The source uses continuous unit-sphere fields and periodic time functions. Three workers render a bounded queue of six frames. Review frames at 0, 5, 10, 15 and the final frame are written under ignored `tmp/motion-review/`.

The full-sphere player maps the corresponding latitude range to the clipped LED cap. V2 uses the central 2048×620 panoramic region of the same movie, scaled to each band without letterboxing. Its timing is identical to the source. V2 retains the full-width band mapping in `src/partition-layout.js` and `src/band-screen.js`, using `src/data/band-video.json`; no central rectangular window or black letterbox is added. One video decoder supplies all bands. Switching worlds preserves playback intent and position. Static content pauses video decoding.

The earlier aurora movies and their generation scripts remain as reference assets; they are no longer the active movies. Static aurora, Earth, stars and grid modes remain available. Quest 3 playback and frame rate require device verification.

The atlas metadata is generated with `node scripts/generate-band-layout.js` before video encoding. Lower floors 1/2 occupy the 588-pixel strip; upper floors 3/4 occupy the 844-pixel strip. All screen surfaces receive video. The upper strip blends from arc mapping into a continuous front projection between 45% and 75% of its height, using the middle of the image near the apex. This removes radial pole tears without a black mask. The two-band shader and videos use new asset URLs together, avoiding cached three-band footage with new UV bounds.

## Mountain sunset

The additional preset uses [Sweeping Timelapse of Mountains and Clouds at Sunset](https://www.pexels.com/video/sweeping-timelapse-of-mountains-and-clouds-at-sunset-36753274/) by **Giuseppe Paoletti**, under the [Pexels License](https://www.pexels.com/license/) checked on 2026-10-21. The license permits free use in a website/app and modifications; the app credits the creator. This project is not a stock-footage redistribution service. The original download stays in ignored `tmp/sunset/`; only adapted playback assets are published.

- Verified source: 3840×2160, 25 fps, 8 seconds.
- `sphere-sunset-loop.mp4`: 3840×1920, 24 fps, 8 seconds, silent H.264 High / yuv420p. Trims the bottom foreground. A full-width landscape shader maps the image across the screen arc and moves the horizon lower with a square-root vertical fit. It does not wrap a flat image across an equirectangular pole. This is a presentation fit, not a calibrated angular projection.
- `sphere-sunset-two-bands.mp4`: 3072×1432, 24 fps, 8 seconds. Each of the two strips is a separate aspect-matched cover crop around the mountain/cloud horizon; it is not a squashed full-frame copy.
- Posters use matching `.jpg` filenames. `public/media/sunset-credits.json` stores source, license and adaptation metadata.
- Reproduce with `python scripts/prepare-sunset-video.py --ffmpeg /path/to/ffmpeg`. Use `--target bands` to preserve the existing full-screen clip. The downloaded source is required at the documented default input path, or use `--input`.

This is a conventional landscape video mapped onto a curved surface, not native 360° capture. It does not represent the landscape's true angular field of view. The 8-second clip repeats from its beginning; it is not advertised as a seamless temporal loop.

The top **재생 영상** selector works in every world, including V2. **다음 영상** in the Quest menu cycles through the same presets. Changing the movie starts it at zero while preserving pause/play intent. Changing the world preserves the selected movie and time. Shared seat URLs include the selected video ID. Static content options remain available outside V2.

Research 09 validation: both sunset outputs decode through 192 frames without errors. All 40 tests pass, including preset selection, timeline reset, pause retention, world changes and the landscape shader. Chrome playback, source switching and pause retention were checked in the local build.
