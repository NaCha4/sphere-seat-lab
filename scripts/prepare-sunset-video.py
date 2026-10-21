"""Prepare the licensed 4K mountain sunset clip for both screen layouts.

Source: Giuseppe Paoletti / Pexels 36753274. See public/media/sunset-credits.json.
Keep the downloaded original under ignored tmp/, not in the published assets.
"""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--ffmpeg', default='ffmpeg')
parser.add_argument('--input', default='tmp/sunset/pexels-36753274-original.mp4')
args = parser.parse_args()
layout = json.loads(Path('src/data/band-video.json').read_text(encoding='utf-8'))
output = Path('public/media')
output.mkdir(parents=True, exist_ok=True)
flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def encode(name, filters, complex_filter=False):
    command = [args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', args.input]
    command += ['-filter_complex', filters, '-map', '[out]'] if complex_filter else ['-vf', filters]
    command += ['-t', '8', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
                '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '5.1', '-threads', '4',
                '-movflags', '+faststart', '-metadata', 'title=Mountain Sunset',
                '-metadata', 'comment=Adapted from Giuseppe Paoletti / Pexels 36753274 under the Pexels License.',
                str(output / f'{name}.mp4')]
    subprocess.run(command, check=True, creationflags=flags)
    subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-ss', '2',
                    '-i', str(output / f'{name}.mp4'), '-frames:v', '1', '-q:v', '2',
                    str(output / f'{name}.jpg')], check=True, creationflags=flags)
    print(f'Created {name}', flush=True)


# Trim the unneeded foreground at the bottom; retain the complete 4K width.
encode('sphere-sunset-loop', 'fps=24,crop=3840:1920:0:0,setsar=1')
# Each strip is a cover crop at its own aspect ratio, not a vertically squashed
# copy. Keep the mountain/cloud horizon around source y=730 for all three.
parts = ['[0:v]fps=24,split=3[a][b][c]']
for label, band in zip('abc', layout['bands']):
    height = round(3840 * band['height'] / band['width'] / 2) * 2
    top = round((730 - height / 2) / 2) * 2
    parts.append(f"[{label}]crop=3840:{height}:0:{top},scale={band['width']}:{band['height']}:flags=lanczos,setsar=1[s{band['id']}]")
parts.append('[s1][s2][s3]vstack=inputs=3[out]')
encode('sphere-sunset-bands', ';'.join(parts), True)
