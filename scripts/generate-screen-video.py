"""Generate the self-authored, seamless 360-degree screen movie.

Requires numpy, Pillow and an ffmpeg executable with libx264.
python scripts/generate-screen-video.py --ffmpeg /path/to/ffmpeg
"""
import argparse
import math
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--output', default='public/media/sphere-aurora-loop.mp4')
    args = parser.parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    width, height, fps, duration = 2048, 1024, 24, 20
    longitude = np.linspace(-math.pi, math.pi, width, dtype=np.float32)[None, :]
    latitude = np.linspace(math.pi / 2, -math.pi / 2, height, dtype=np.float32)[:, None]
    x = np.cos(latitude) * np.sin(longitude)
    z = -np.cos(latitude) * np.cos(longitude)
    y = np.broadcast_to(np.sin(latitude), x.shape)
    cloud = .5 + .5 * np.sin(x * 5 + z * 3) * np.sin(z * 4 - y * 2)
    stars = np.maximum(0, (np.sin(x * 139 + z * 91 + y * 17) * np.sin(z * 157 - y * 113 + x * 63) - .985) / .015) ** 4
    base = np.empty((height, width, 3), dtype=np.float32)
    base[:, :, 0] = 4 + cloud * 4 + stars * 185
    base[:, :, 1] = 9 + cloud * 7 + stars * 191
    base[:, :, 2] = 24 + cloud * 17 + stars * 210
    command = [args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', f'{width}x{height}',
               '-framerate', str(fps), '-i', '-', '-an', '-c:v', 'libx264',
               '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
               '-profile:v', 'high', '-level:v', '4.2', '-threads', '4',
               '-movflags', '+faststart', '-metadata', 'title=Sphere Aurora Orbit',
               '-metadata', 'comment=Self-authored 360 equirectangular loop; generated from a continuous unit-sphere field.',
               str(output)]
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    process = subprocess.Popen(command, stdin=subprocess.PIPE, creationflags=flags)
    try:
        for frame in range(fps * duration):
            phase = 2 * math.pi * frame / (fps * duration)
            sweep = np.sin(x * 4 + z * 3 + phase) + .32 * np.sin(x * 10 - z * 7 - phase * 2)
            band = y - .13 - sweep * .20
            curtain = np.exp(-band * band * 36)
            folds = .38 + .62 * (.5 + .5 * np.sin(x * 37 + z * 29 + sweep * 4 - phase * 2)) ** 2
            glow = curtain * folds
            crown_offset = y - .69 - .085 * np.sin(x * 7 - z * 5 + phase)
            crown = np.exp(-crown_offset * crown_offset * 60)
            hue = .5 + .5 * np.sin(x * 3.5 - z * 3 + phase)
            rgb = base.copy()
            rgb[:, :, 0] += glow * (20 + hue * 31) + crown * 42
            rgb[:, :, 1] += glow * (168 - hue * 49) + crown * 17
            rgb[:, :, 2] += glow * (87 + hue * 107) + crown * 77
            encoded = np.clip(rgb, 0, 255).astype(np.uint8)
            process.stdin.write(encoded.tobytes())
            if frame == 0:
                Image.fromarray(encoded).save(output.with_name('sphere-aurora-poster.jpg'), quality=90)
            if frame % (fps * 4) == 0:
                print(f'Encoded {frame // fps}/{duration} seconds', flush=True)
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('ffmpeg failed to encode the sphere movie')
    except BaseException:
        process.kill()
        raise
    print(f'Created {output}: {output.stat().st_size / 1024 / 1024:.2f} MiB', flush=True)


if __name__ == '__main__':
    main()
