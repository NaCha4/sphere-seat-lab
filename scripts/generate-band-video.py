"""Render three individually proportioned panoramic aurora strips in one MP4.

Run node scripts/generate-band-layout.js first. The atlas uses one decoder on
Quest; standalone MP4s for each band are also written beside the atlas.
"""
import argparse
import json
import math
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image


def prepare_strip(width, height, seed=23):
    u = np.linspace(0, 1, width, endpoint=False, dtype=np.float32)[None, :]
    v = np.linspace(1, 0, height, dtype=np.float32)[:, None]
    x = u * np.float32(2 * math.pi)
    base = np.zeros((height, width, 3), dtype=np.float32)
    haze = np.exp(-((v - .23) * 3.4) ** 2)
    for channel, (night, light) in enumerate([(6, 7), (12, 19), (27, 30)]):
        base[:, :, channel] = night + haze * light
    # A stable skyline and stars give the eye fixed spatial references. All
    # time-dependent expressions below are periodic over the 20-second loop.
    ridge = .08 + .024 * np.sin(x * 3 + .4) + .013 * np.sin(x * 11) + .006 * np.sin(x * 31)
    mountain = v < ridge
    rng = np.random.default_rng(seed)
    stars = np.zeros((height, width), dtype=np.float32)
    for _ in range(max(60, width // 9)):
        col = int(rng.integers(1, width - 1))
        row = int(rng.integers(1, max(2, int(height * .84))))
        stars[row, col] = rng.uniform(55, 150)
    for channel, tint in enumerate([.65, .80, 1]):
        base[:, :, channel] += stars * tint
    return x, v, base, mountain


def render_strip(prepared, phase):
    x, v, base, mountain = prepared
    rgb = base.copy()
    # Several broad ribbons occupy the entire panoramic width. No letterbox,
    # pillarbox, source crop or moving camera is baked into any strip.
    for index, (level, spread, tint) in enumerate([
        (.38, 20, (20, 148, 123)),
        (.60, 32, (34, 105, 159)),
        (.79, 46, (94, 37, 136)),
    ]):
        wave = level + .07 * np.sin(x * (2 + index) + phase + index) + .035 * np.sin(x * 5 - 2 * phase)
        glow = np.exp(-((v - wave) ** 2) * spread)
        folds = .42 + .58 * (.5 + .5 * np.sin(x * (32 + index * 7) + .8 * np.sin(x * 4 + phase) + v * 4 - phase * 2)) ** 2
        glow *= folds
        for channel, value in enumerate(tint):
            rgb[:, :, channel] += glow * value
    # Opaque hills along the lower edge, with a subtle stationary contour.
    for channel, value in enumerate([4, 9, 16]):
        rgb[:, :, channel] = np.where(mountain, value, rgb[:, :, channel])
    return np.clip(rgb, 0, 255).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--layout', default='src/data/band-video.json')
    parser.add_argument('--output', default='public/media/sphere-wide-bands.mp4')
    args = parser.parse_args()
    layout = json.loads(Path(args.layout).read_text(encoding='utf-8'))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    width, height = layout['width'], layout['height']
    fps, duration = layout['fps'], layout['duration']
    strips = [prepare_strip(b['width'], b['height']) for b in layout['bands']]
    command = [args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', f'{width}x{height}',
               '-framerate', str(fps), '-i', '-', '-an', '-c:v', 'libx264',
               '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
               '-profile:v', 'high', '-level:v', '5.1', '-threads', '4',
               '-movflags', '+faststart', '-metadata', 'title=Sphere Wide Aurora - Three Bands',
               '-metadata', 'comment=Self-authored panoramic strips individually fitted to three curved screen bands.', str(output)]
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    process = subprocess.Popen(command, stdin=subprocess.PIPE, creationflags=flags)
    review = Path('tmp/wide-video')
    review.mkdir(parents=True, exist_ok=True)
    try:
        for frame in range(fps * duration):
            phase = 2 * math.pi * frame / (fps * duration)
            images = [render_strip(s, phase) for s in strips]
            atlas = np.concatenate(images, axis=0)
            process.stdin.write(atlas.tobytes())
            if frame == 0:
                Image.fromarray(atlas).save(output.with_name('sphere-wide-bands-poster.jpg'), quality=92)
                for band, strip in zip(layout['bands'], images):
                    Image.fromarray(strip).save(review / f"band-{band['id']}-poster.jpg", quality=94)
            if frame % (fps * 5) == 0:
                print(f'Encoded {frame // fps}/{duration} seconds', flush=True)
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('ffmpeg failed to encode the band movie')
    except BaseException:
        process.kill()
        raise
    for band in layout['bands']:
        target = output.with_name(f"sphere-wide-band-{band['id']}.mp4")
        subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(output),
                        '-vf', f"crop={band['width']}:{band['height']}:0:{band['row']}",
                        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target)],
                       check=True, creationflags=flags)
        print(f"Band {band['id']}: {band['width']} x {band['height']} -> {target}", flush=True)
    print(f'Created {output}: {output.stat().st_size / 1024 / 1024:.2f} MiB', flush=True)


if __name__ == '__main__':
    main()
