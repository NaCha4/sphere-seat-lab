"""Self-authored Chromatic Flux loops, for the dome and three-band atlas.

NumPy / Pillow / ffmpeg (libx264). All fields are continuous on a unit sphere
and periodic over 20 seconds; no external images, footage or audio are used.
"""
import argparse
import json
import math
from pathlib import Path
import subprocess
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image


def prepare(width, height):
    longitude = np.linspace(-math.pi, math.pi, width, endpoint=False, dtype=np.float32)[None, :]
    latitude = np.linspace(math.pi/2, -math.pi/2, height, dtype=np.float32)[:, None]
    x = np.cos(latitude) * np.sin(longitude)
    z = -np.cos(latitude) * np.cos(longitude)
    y = np.broadcast_to(np.sin(latitude), x.shape)
    a, b = 5*x + 3*y + 2*z, 4*z - 6*y + 3*x
    radial = np.arccos(np.clip(-.94*z + .341174*y, -1, 1))
    sparks = np.maximum(0, np.sin(137*x+91*z)*np.sin(113*y-73*z)-.98)*3500
    return x, y, z, a, b, radial, sparks


def render(field, phase):
    x, y, z, a, b, radial, sparks = field
    # Flowing contour ribbons and expanding rings, with distinct speeds.
    flow = a + 1.15*np.sin(b+2*phase) + .45*np.sin(9*y-4*z-phase) - 3*phase
    contours = np.exp(-np.sin(flow)**2 * 85)
    contour_glow = np.exp(-np.sin(flow)**2 * 7)
    ring_phase = radial*10 - phase*4 + .65*np.sin(a+phase)
    rings = np.exp(-np.sin(ring_phase)**2 * 110)
    # Rotating inclined orbital arcs. Longitudinal seams and poles remain
    # continuous because the artwork uses 3D directions rather than UV edges.
    orbit = x*math.cos(phase) + z*math.sin(phase) + .35*y
    arcs = np.exp(-((orbit-.34*np.sin(4*y+2*phase))/.026)**2)
    hue = .5 + .5*np.sin(b + phase + 1.1*np.sin(a-phase))
    pulse = .72 + .28*np.sin(phase+radial*3)**2
    base = 6 + 9*(.5+.5*np.sin(a*.7-phase))
    rgb = np.empty((*x.shape, 3), dtype=np.float32)
    rgb[:, :, 0] = base + contours*(75+130*hue) + contour_glow*28*hue + rings*170*pulse + arcs*45 + sparks*.7
    rgb[:, :, 1] = base + 4 + contours*(195-85*hue) + contour_glow*35 + rings*66*pulse + arcs*175 + sparks*.85
    rgb[:, :, 2] = base + 13 + contours*210 + contour_glow*51 + rings*(46+80*hue)*pulse + arcs*185 + sparks
    # Smooth highlight roll-off retains colour in overlaps without white cuts.
    rgb = 255*(1-np.exp(-rgb/220))
    return np.clip(rgb, 0, 255).astype(np.uint8)


def initialize_frames(width, height):
    global FIELD
    FIELD = prepare(width, height)


def render_frame(frame):
    return render(FIELD, 2*math.pi*frame/480).tobytes()


def encode_sphere(args):
    width, height = 2048, 1024
    fps, duration = 24, 20
    output = Path('public/media/sphere-motion-loop.mp4')
    output.parent.mkdir(parents=True, exist_ok=True)
    review = Path('tmp/motion-review')
    review.mkdir(parents=True, exist_ok=True)
    command = [args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', f'{width}x{height}',
               '-framerate', str(fps), '-i', '-', '-an', '-c:v', 'libx264',
               '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
               '-profile:v', 'high', '-level:v', '4.2', '-threads', '4',
               '-movflags', '+faststart', '-metadata', 'title=Chromatic Flux - sphere',
               '-metadata', 'comment=Original procedural motion graphics, periodic 3D fields, no external footage.', str(output)]
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    process = subprocess.Popen(command, stdin=subprocess.PIPE, creationflags=flags)
    try:
        with ProcessPoolExecutor(max_workers=3, initializer=initialize_frames,
                                 initargs=(width,height)) as pool:
            # Bound in-flight RGB buffers; full-resolution frames are large.
            pending = [pool.submit(render_frame, frame) for frame in range(6)]
            for frame in range(fps*duration):
                encoded = pending.pop(0).result()
                if frame+6 < fps*duration:
                    pending.append(pool.submit(render_frame,frame+6))
                process.stdin.write(encoded)
                if frame in [0, 120, 240, 360, 479]:
                    image = np.frombuffer(encoded,dtype=np.uint8).reshape(height,width,3)
                    if frame == 0:
                        Image.fromarray(image).save(output.with_suffix('.jpg'), quality=92)
                    Image.fromarray(image).save(review / f'sphere-{frame:03d}.jpg', quality=90)
                    print(f'sphere: {frame}/{fps*duration} frames', flush=True)
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('ffmpeg encoding failed')
    except BaseException:
        process.kill()
        raise
    print(f'Created {output}: {output.stat().st_size/1048576:.2f} MiB', flush=True)


def encode_bands(args, layout):
    # Derive all strips from the same decoded frames, so comparisons between
    # worlds have identical motion and timing. Trim only the spherical poles.
    source = Path('public/media/sphere-motion-loop.mp4')
    if not source.exists():
        raise FileNotFoundError('Render --target sphere before --target bands')
    output = source.with_name('sphere-motion-bands.mp4')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    filters = ['[0:v]crop=2048:620:0:202,split=3[a][b][c]']
    for label, band in zip('abc', layout['bands']):
        filters.append(f"[{label}]scale={band['width']}:{band['height']}:flags=lanczos[s{band['id']}]")
    filters.append('[s1][s2][s3]vstack=inputs=3[out]')
    subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(source),
                    '-filter_complex',';'.join(filters),'-map','[out]','-an','-c:v','libx264',
                    '-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-profile:v','high',
                    '-level:v','5.1','-threads','4','-movflags','+faststart',str(output)],
                   check=True,creationflags=flags)
    subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(output),
                    '-frames:v','1','-q:v','2',str(output.with_suffix('.jpg'))],check=True,creationflags=flags)
    for band in layout['bands']:
        strip = output.with_name(f"sphere-motion-band-{band['id']}.mp4")
        subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(output),
                        '-vf',f"crop={band['width']}:{band['height']}:0:{band['row']}",
                        '-an','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',
                        '-threads','4','-movflags','+faststart',str(strip)],check=True,creationflags=flags)
    print(f'Created {output}: {output.stat().st_size/1048576:.2f} MiB',flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--target', choices=['sphere', 'bands', 'all'], default='all')
    args = parser.parse_args()
    layout = json.loads(Path('src/data/band-video.json').read_text(encoding='utf-8'))
    if args.target in ['sphere','all']:
        encode_sphere(args)
    if args.target in ['bands','all']:
        encode_bands(args, layout)
