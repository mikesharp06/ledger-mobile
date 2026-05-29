"""Generate Ledger Cat app icons from the source artwork.

Source: icons/ledger_cat_icon.png — an 8-bit cat + coins on a cream tile with
black corners. We flood-fill the black background to the cream paper color so
the result is full-bleed (good for both "any" and "maskable" purposes), then
emit every size the app references.

Requires Pillow:  pip install pillow
"""
from PIL import Image, ImageDraw

SRC = "icons/ledger_cat_icon.png"
PAPER = (247, 243, 236)  # --paper, matches manifest/theme color

specs = [
    ("icons/icon-192.png", 192),
    ("icons/icon-512.png", 512),
    ("icons/maskable-192.png", 192),
    ("icons/maskable-512.png", 512),
    ("icons/apple-touch-icon.png", 180),
    ("icons/favicon-64.png", 64),
]


def load_full_bleed():
    """Open the source and replace the black corner background with paper."""
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    # Flood-fill inward from each corner; a generous threshold absorbs the
    # anti-aliased ring at the rounded tile's edge. The cat/coins are walled
    # off by cream, so their dark outlines are never reached.
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(img, seed, PAPER, thresh=210)
    return img


def main():
    base = load_full_bleed()
    for path, size in specs:
        base.resize((size, size), Image.LANCZOS).save(path)
        print("wrote", path)


if __name__ == "__main__":
    main()
