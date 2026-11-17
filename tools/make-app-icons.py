# Draws the home-screen icons (assets/icons/*.png). Run: python3 tools/make-app-icons.py
from PIL import Image, ImageDraw, ImageFont
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def icon(size, maskable):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 0 if maskable else int(size * 0.06)
    radius = 0 if maskable else int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad - 1, size - pad - 1], radius=radius, fill=(15, 118, 110))
    inner = size * (0.62 if maskable else 0.70)       # maskable icons keep content in the middle 80%
    font = ImageFont.truetype(FONT, int(inner * 0.78), index=3)
    box = d.textbbox((0, 0), '藥', font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] - size * 0.03), '藥', font=font, fill=(255, 255, 255))
    # a small capsule under the character
    cw, ch = size * 0.30, size * 0.075
    x0, y0 = (size - cw) / 2, size * (0.76 if maskable else 0.79)
    d.rounded_rectangle([x0, y0, x0 + cw, y0 + ch], radius=ch / 2, fill=(253, 230, 138))
    d.rounded_rectangle([x0 + cw / 2, y0, x0 + cw, y0 + ch], radius=ch / 2, fill=(255, 255, 255))
    d.rectangle([x0 + cw / 2, y0, x0 + cw / 2 + ch / 2, y0 + ch], fill=(255, 255, 255))
    return img
for size in (192, 512):
    icon(size, False).save(f'assets/icons/icon-{size}.png', optimize=True)
icon(512, True).save('assets/icons/icon-maskable-512.png', optimize=True)
icon(180, True).convert('RGB').save('assets/icons/apple-touch-icon.png', optimize=True)
print('ok')
