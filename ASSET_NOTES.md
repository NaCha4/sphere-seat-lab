# Screen content

The default screen is the self-authored **Sphere Aurora Orbit** movie in `public/media/sphere-aurora-loop.mp4`.

- 2048 × 1024 pixels, 2:1 full-sphere equirectangular projection.
- 20 seconds, 24 fps, 480 frames, H.264 High / yuv420p, silent, looping.
- 1,570,157 bytes (about 1.50 MiB). The MP4 uses fast-start metadata for web delivery.
- Original procedural artwork, generated from smooth functions of 3D unit-sphere coordinates. No external footage, recording, image or soundtrack is included.
- `scripts/generate-screen-video.py` reproduces the clip with NumPy, Pillow and an ffmpeg binary supporting libx264. These tools are needed only to regenerate the asset, not to run or build the website.

`src/screen-video.js` maps the full-sphere video's latitude to the clipped LED surface. It retains the panorama's longitude and does not stretch 180 degrees into the smaller screen cap. The artwork joins across the longitude seam and changes smoothly over a full 20-second cycle. Viewing from different seats still changes the physical perspective.

The player is muted, inline and looping. Desktop and VR controls provide play/pause. Switching to a static screen pauses decoding, and an explicit pause is preserved when returning to the movie. The original static aurora remains visible while the first frame loads. The dark roof remains outside the LED content.

`public/media/sphere-aurora-poster.jpg` is the first frame. Optional static aurora, Earth, stars and UV grid remain available. The previous AI-generated Chiikawa image remains only in Git history.

Validation: all 480 frames decoded without errors; frames at 0, 5, 10 and 19.95 seconds inspected; mapping, transport, blocked-autoplay recovery, disposal and material handover covered by automated tests. Browser/Quest playback still requires device verification.


## Wide three-band movie — 2026-10-21

V2 uses `public/media/sphere-wide-bands.mp4`: a 3072×1450 atlas of three synchronized, self-authored panoramic aurora strips. Individual strip sizes are 3072×314, 3072×292 and 3072×844. Duration is 20 seconds at 24 fps, H.264/yuv420p, silent and looping. The three compositions are generated for their respective aspect ratios; the former central 2:1 window and its black margins are removed.

`node scripts/generate-band-layout.js` derives the atlas layout from the current band geometry. `python scripts/generate-band-video.py --ffmpeg /path/to/ffmpeg` generates the movie and poster, plus standalone strip videos in `public/media/`. `src/data/band-video.json` records the layout. `band-screen.js` maps each height's complete horizontal arc to the correct strip, with half-texel insets to avoid neighbouring-strip bleed.

The upright aurora video remains the source for the baseline and V1. Source changes reuse one video element and preserve play/pause intent and the timeline after metadata loads. No external footage or music is used.

Validation: all four new videos decode through 480 frames without errors. Desktop Chrome playback and full-width mapping were checked locally; Quest playback remains unverified.
