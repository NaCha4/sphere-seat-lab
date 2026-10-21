"""Decode all regenerated 25-degree videos and check their encoded dimensions."""
import argparse
import json
import re
import subprocess
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--ffmpeg',default='ffmpeg')
args=parser.parse_args()
layout=json.loads(Path('src/data/band-video.json').read_text(encoding='utf-8'))
results=[]
for name,duration in [('motion',20),('sunset',8)]:
    variants=[('two-bands',(layout['width'],layout['height']))]
    variants += [(f"zone-{b['id']}",(b['width'],b['height'])) for b in layout['bands']]
    for variant,size in variants:
        file=Path(f'public/media/sphere-{name}-{variant}-25deg.mp4')
        run=subprocess.run([args.ffmpeg,'-hide_banner','-i',str(file),'-map','0:v:0','-an',
                            '-progress','pipe:1','-f','null','-'],capture_output=True,text=True,
                           creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),check=True)
        match=re.search(r'Video:.*? (\d{2,5})x(\d{2,5})(?:[,\s])',run.stderr)
        actual=tuple(map(int,match.groups())) if match else None
        assert actual==size,(str(file),actual,size)
        frames=int(re.findall(r'^frame=(\d+)$',run.stdout,re.M)[-1])
        assert frames==duration*layout['fps'],(str(file),frames)
        assert not re.search(r'Error|corrupt|Invalid',run.stderr,re.I),str(file)
        if variant=='two-bands':
            with Image.open(file.with_suffix('.jpg')) as poster: assert poster.size==size
        results.append({'file':str(file),'width':size[0],'height':size[1],'frames':frames,'decoded':True})
print(json.dumps(results,indent=2))
