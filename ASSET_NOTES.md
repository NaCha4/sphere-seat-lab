# Screen content — Research 08

All three worlds now use **Chromatic Flux**, a self-authored procedural motion graphic. Rotating neon orbits, flowing contours and expanding rings replace the aurora movie. It has a continuous 20-second loop with no cuts, audio, external footage or images. This is presentation content, not evidence of reduced motion sickness.

| World | Video | Dimensions |
| --- | --- | --- |
| Original / V1 | `public/media/sphere-motion-loop.mp4` | 2048×1024, full-sphere equirectangular |
| V2 | `public/media/sphere-motion-bands.mp4` | 3072×1450, synchronized three-strip atlas |

Both are 24 fps / 480 frames, H.264 High, yuv420p, silent, looping, with fast-start metadata. Posters have the same base name and `.jpg` extension. Separate V2 exports are `sphere-motion-band-1.mp4` (3072×314), `sphere-motion-band-2.mp4` (3072×292), and `sphere-motion-band-3.mp4` (3072×844).

`python scripts/generate-motion-video.py --ffmpeg /path/to/ffmpeg` reproduces all outputs using NumPy, Pillow and an ffmpeg binary with libx264. `--target sphere` renders the source; `--target bands` derives the atlas from the existing source. The source uses continuous unit-sphere fields and periodic time functions. Three workers render a bounded queue of six frames. Review frames at 0, 5, 10, 15 and the final frame are written under ignored `tmp/motion-review/`.

The full-sphere player maps the corresponding latitude range to the clipped LED cap. V2 uses the central 2048×620 panoramic region of the same movie, scaled to each band without letterboxing. Its timing is identical to the source. V2 retains the full-width band mapping in `src/partition-layout.js` and `src/band-screen.js`, using `src/data/band-video.json`; no central rectangular window or black letterbox is added. One video decoder supplies all bands. Switching worlds preserves playback intent and position. Static content pauses video decoding.

The earlier aurora movies and their generation scripts remain as reference assets; they are no longer the active movies. Static aurora, Earth, stars and grid modes remain available. Quest 3 playback and frame rate require device verification.

Validation: all five MP4s decoded through 480 frames without errors. All three worlds played in local Chrome without console errors. The 38-test suite and production build passed.
