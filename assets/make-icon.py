"""Generates Uni Ranked app icons from Cinzel Decorative 'R'."""
from PIL import Image, ImageDraw, ImageFont

DARK_BG = (11, 12, 14, 255) # #0B0C0E
WHITE = (255, 255, 255, 255)
FONT_PATH = "/tmp/fonts/CinzelDecorative-Bold.ttf"

def render_r(size, scale_factor=0.68, bg_color=DARK_BG):
    img = Image.new("RGBA", (size, size), bg_color or (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font_size = int(size * scale_factor)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), "R", font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1]
    draw.text((tx, ty), "R", font=font, fill=WHITE)
    return img

full = render_r(1024, scale_factor=0.68, bg_color=DARK_BG)
full.save("assets/icon-only.png")

fg = render_r(1024, scale_factor=0.52, bg_color=None)
fg.save("assets/icon-foreground.png")

Image.new("RGBA", (1024, 1024), DARK_BG).save("assets/icon-background.png")
