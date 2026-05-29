from PIL import Image, ImageDraw

# Warm paper ledger palette
CREAM = (247, 243, 236)
INK   = (31, 27, 22)
GREEN = (47, 107, 79)
CLAY  = (194, 90, 60)
TAN   = (229, 221, 207)

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def make_icon(size, maskable=False):
    # Supersample for crisp edges
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background tile. Maskable keeps art inside center safe zone.
    radius = int(s * (0.30 if maskable else 0.22))
    rounded(d, [0, 0, s - 1, s - 1], radius, CREAM)

    # Safe inset for the motif
    pad = s * (0.26 if maskable else 0.20)
    inner = s - 2 * pad
    base_y = pad + inner * 0.86          # ledger baseline
    bar_w = inner * 0.17
    gap = (inner - 3 * bar_w) / 2
    heights = [0.42, 0.66, 0.92]          # ascending bars = tracking/growth
    colors = [TAN, CLAY, GREEN]
    x = pad
    for h, c in zip(heights, colors):
        top = base_y - inner * h
        rounded(d, [x, top, x + bar_w, base_y], bar_w * 0.45, c)
        x += bar_w + gap

    # Ledger baseline rule
    d.rounded_rectangle(
        [pad, base_y + inner * 0.02, s - pad, base_y + inner * 0.055],
        radius=s * 0.01, fill=INK,
    )

    return img.resize((size, size), Image.LANCZOS)

specs = [
    ("icons/icon-192.png", 192, False),
    ("icons/icon-512.png", 512, False),
    ("icons/maskable-192.png", 192, True),
    ("icons/maskable-512.png", 512, True),
    ("icons/apple-touch-icon.png", 180, False),
    ("icons/favicon-64.png", 64, False),
]
for path, size, mask in specs:
    make_icon(size, mask).save(path)
    print("wrote", path)
