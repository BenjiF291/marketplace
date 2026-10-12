"""Build the 96-pose animal atlases used by companions.js.

Requires opencv-python-headless, numpy and Pillow.
Run: python scripts/generate-companion-tweens.py
The six original poses are retained, including a tween back to the first pose.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
SIZE=256
STEPS=16
COLS=8
ROWS=12

def remap(values,mapping):
    return cv2.remap(values,mapping[...,0],mapping[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

def premultiply(frame):
    values=frame.astype(np.float32)/255
    values[...,:3]*=values[...,3:4]
    return values

def unpack(values):
    alpha=np.clip(values[...,3:4],0,1)
    rgb=values[...,:3]/np.maximum(alpha,1/255)
    out=np.concatenate((np.clip(rgb,0,1),alpha),axis=2)
    return np.round(out*255).astype(np.uint8)

def gray(frame):
    # Include silhouette information, especially for black feet on transparency.
    luma=cv2.cvtColor(frame[...,:3],cv2.COLOR_RGB2GRAY)
    return np.round(luma*.65+frame[...,3]*.35).astype(np.uint8)

for kind in ['fox','snail','dragon']:
    sheet=np.array(Image.open(ROOT/f'public/assets/companions/{kind}-idle-v6.webp').convert('RGBA'))
    frames=[cv2.resize(sheet[:,i*512:(i+1)*512],(SIZE,SIZE),interpolation=cv2.INTER_AREA) for i in range(6)]
    h,w=frames[0].shape[:2]
    xx,yy=np.meshgrid(np.arange(w,dtype=np.float32),np.arange(h,dtype=np.float32))
    grid=np.stack((xx,yy),axis=2)
    atlas=Image.new('RGBA',(SIZE*COLS,SIZE*ROWS))
    flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flow.setFinestScale(0)
    flow.setVariationalRefinementIterations(20)
    for index in range(6):
        a,b=frames[index],frames[(index+1)%6]
        forward=flow.calc(gray(a),gray(b),None)
        backward=flow.calc(gray(b),gray(a),None)
        # Forward/backward consistency reduces doubling in occluded regions.
        error_a=np.linalg.norm(forward+remap(backward,grid+forward),axis=2)
        error_b=np.linalg.norm(backward+remap(forward,grid+backward),axis=2)
        confidence_a=np.maximum(.05,np.exp(-error_a/6)).astype(np.float32)
        confidence_b=np.maximum(.05,np.exp(-error_b/6)).astype(np.float32)
        pa,pb=premultiply(a),premultiply(b)
        for step in range(STEPS):
            t=step/STEPS
            if not step:
                result=a
            else:
                # Invert motion by iteration rather than sliding a whole image.
                ma,mb=grid.copy(),grid.copy()
                for _ in range(4):
                    ma=grid-t*remap(forward,ma)
                    mb=grid-(1-t)*remap(backward,mb)
                wa=(1-t)*remap(confidence_a,ma)[...,None]
                wb=t*remap(confidence_b,mb)[...,None]
                values=(wa*remap(pa,ma)+wb*remap(pb,mb))/np.maximum(wa+wb,1e-6)
                result=unpack(values)
            frame=Image.fromarray(result)
            n=index*STEPS+step
            atlas.paste(frame,((n%COLS)*SIZE,(n//COLS)*SIZE))
    target=ROOT/f'public/assets/companions/{kind}-smooth-v7.webp'
    atlas.save(target,quality=94,method=6)
    print(kind,'96 frames',atlas.size,target.stat().st_size,'bytes',flush=True)
