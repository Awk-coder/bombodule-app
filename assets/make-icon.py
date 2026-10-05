"""Generates Hadir icon sources for @capacitor/assets: green tile with a dark check mark."""
from PIL import Image, ImageDraw

GREEN, DARK, S = (72, 222, 124, 255), (6, 33, 15, 255), 1024


def check(draw, scale, offset):
    pts = [(300, 540), (450, 690), (740, 360)]
    pts = [(offset + x * scale, offset + y * scale) for x, y in pts]
    draw.line(pts, fill=DARK, width=int(110 * scale), joint="curve")
    for x, y in (pts[0], pts[-1]):
        r = 55 * scale
        draw.ellipse([x - r, y - r, x + r, y + r], fill=DARK)


full = Image.new("RGBA", (S, S), GREEN)
check(ImageDraw.Draw(full), 1.0, 0)
full.save("assets/icon-only.png")

fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
check(ImageDraw.Draw(fg), 0.62, S * 0.19)  # keep inside the adaptive-icon safe zone
fg.save("assets/icon-foreground.png")

Image.new("RGBA", (S, S), GREEN).save("assets/icon-background.png")
