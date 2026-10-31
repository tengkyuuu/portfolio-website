"""A short, once-playing geometric letter animation for HTML email (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
import math

OUT = Path(__file__).resolve().parents[1] / 'public' / 'invitations'
OUT.mkdir(exist_ok=True)
W, H, S = 600, 260, 2
BLUE, PAPER, PALE, INK = '#244b87', '#ffffff', '#dce7f7', '#a9c3e8'

def ease_out(progress):
    # cubic-bezier(.23, 1, .32, 1), shared with the UI's authored entrance.
    lo, hi = 0., 1.
    for _ in range(24):
        u = (lo + hi) / 2
        x = 3*(1-u)**2*u*.23 + 3*(1-u)*u*u*.32 + u**3
        if x < progress: lo = u
        else: hi = u
    return 1 - (1-(lo+hi)/2)**3

def frame(t):
    im = Image.new('RGB', (W*S, H*S), BLUE)
    d = ImageDraw.Draw(im)
    def poly(points, fill): d.polygon([(int(x*S), int(y*S)) for x,y in points], fill=fill)
    def line(points, fill, width=1): d.line([(int(x*S), int(y*S)) for x,y in points], fill=fill, width=width*S)
    def rect(box, fill): d.rectangle(tuple(int(v*S) for v in box), fill=fill)
    # A path into the document, with an unhurried paper-plane arrival.
    for x in range(30, 560, 16):
        y = 146 + math.sin(x/74)*28
        line([(x,y),(x+5,y-1)], '#5074a8')
    lift = 46 * ease_out(min(1, t/0.65))
    poly([(205,115),(300,52),(395,115),(395,216),(205,216)], '#789ac9')
    py = 103 - lift
    rect((225,py,375,py+136), PAPER)
    rect((225,py,375,py+21), '#e8f0fb')
    # The W mark is geometry, keeping asset generation font-independent.
    line([(240,py+5),(243,py+15),(247,py+7),(251,py+15),(254,py+5)], BLUE, 2)
    rect((265,py+8,353,py+11), INK)
    rect((243,py+38,349,py+43), BLUE)
    rect((243,py+53,329,py+57), INK)
    rect((243,py+69,354,py+72), PALE)
    rect((243,py+79,338,py+82), PALE)
    rect((243,py+96,295,py+109), BLUE)
    # Envelope folds stay fixed while the document rises out of it.
    poly([(205,115),(300,167),(395,115),(395,216),(205,216)], PALE)
    poly([(205,216),(300,153),(395,216)], '#f4f7fc')
    line([(205,115),(300,167),(395,115)], '#b4c9e5')
    # Plane follows one short flight, then rests beside the open letter.
    p = ease_out(min(1,t/0.9))
    px, yy = 90+355*p, 152-65*p-32*math.sin(p*math.pi)
    poly([(px-18,yy+5),(px+21,yy-13),(px+8,yy+22),(px-1,yy+10)], PAPER)
    line([(px-1,yy+10),(px+21,yy-13)], '#789ac9')
    return im.resize((W,H), Image.Resampling.LANCZOS)

frames = [frame(i/39) for i in range(40)]
# No loop extension: play once, stopping on the complete open letter.
frames[0].save(OUT/'letter-opening-v1.gif', save_all=True, append_images=frames[1:],
               duration=[100]*39+[100], optimize=True, disposal=1)
frames[-1].save(OUT/'letter-open-v1.png', optimize=True)
print(f'Invitation artwork: {len(frames)} frames, 4 seconds, {(OUT/"letter-opening-v1.gif").stat().st_size//1024} KB')
