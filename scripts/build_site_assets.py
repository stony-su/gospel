"""The landing site's pictures, from the mockups in screenshots/mockups/.

Each mockup is a 16000 x 12000 transparent render of one, two or three
phones, most of it empty. The site wants the phones alone, at a size a
browser can load without noticing: each render is cropped to the phones,
given a sliver of margin so a shadow is not cut flat, and written twice as
WebP with its transparency kept - a 2x file for high-density screens and a
1x file for everything else. Lanczos on the way down, which is what keeps
the hairlines on the screens from turning to mush.

The files are named for what the phones show, not for the device rendered,
because the page talks about the plan and the grocery list, never about
iPhones.

The icons come from the app's own, already drawn by build_app_icon.py, and
the picture a link preview shows is the hero render on the page's black.

Run:  python scripts/build_site_assets.py
Out:  site/assets/*.webp
      site/assets/og.png             1200 x 630, for link previews
      site/favicon.png               the app's favicon, as is
      site/apple-touch-icon.png      180, from the app icon
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the renders are 192 megapixels each

ROOT = Path(__file__).resolve().parent.parent
MOCKUPS = ROOT / "screenshots" / "mockups"
ASSETS = ROOT / "assets"
SITE = ROOT / "site"
OUT = SITE / "assets"

# Source render -> name on the site. The renders are named by phone model.
PICTURES = {
    "iPhone 15 Pro.png": "recipe-and-swap",        # recipe page, swap radar, tilted
    "iPhone 16 Pro.png": "plan-and-nutrition",     # weekly plan, nutrition groups
    "iPhone 16.png": "nutrient-and-options",       # protein detail, breakfast options
    "iPhone 13 Pro.png": "grocery-and-references",  # grocery, macronutrients, sources
}

# Longest edge in pixels. The largest picture sits about 1100 CSS px wide on
# a desktop, so 2400 covers a 2x screen with a little to spare.
SIZES = {"2x": 2400, "1x": 1200}
MARGIN = 0.015  # of the crop, each side
QUALITY = 86


def build(source: Path, name: str) -> None:
    render = Image.open(source).convert("RGBA")
    left, top, right, bottom = render.getbbox()
    pad_x = int((right - left) * MARGIN)
    pad_y = int((bottom - top) * MARGIN)
    crop = render.crop((
        max(left - pad_x, 0),
        max(top - pad_y, 0),
        min(right + pad_x, render.width),
        min(bottom + pad_y, render.height),
    ))
    print(f"{source.name}: {render.width}x{render.height} -> crop {crop.width}x{crop.height}")

    for suffix, longest in SIZES.items():
        scale = longest / max(crop.size)
        size = (round(crop.width * scale), round(crop.height * scale))
        small = crop.resize(size, Image.Resampling.LANCZOS)
        target = OUT / f"{name}@{suffix}.webp"
        small.save(target, "WEBP", quality=QUALITY, method=6)
        print(f"  {target.name}: {size[0]}x{size[1]}, {target.stat().st_size / 1024:.0f} KB")


def icons() -> None:
    favicon = ASSETS / "favicon.png"
    (SITE / "favicon.png").write_bytes(favicon.read_bytes())
    icon = Image.open(ASSETS / "icon.png").convert("RGB")
    icon.resize((180, 180), Image.Resampling.LANCZOS).save(SITE / "apple-touch-icon.png")
    print("favicon.png, apple-touch-icon.png")


def preview_card() -> None:
    """The hero render, fitted on black, for a link preview."""
    width, height = 1200, 630
    card = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    render = Image.open(MOCKUPS / "iPhone 15 Pro.png").convert("RGBA")
    render = render.crop(render.getbbox())
    inset = 40
    scale = min((width - 2 * inset) / render.width, (height - 2 * inset) / render.height)
    size = (round(render.width * scale), round(render.height * scale))
    render = render.resize(size, Image.Resampling.LANCZOS)
    card.alpha_composite(render, ((width - size[0]) // 2, (height - size[1]) // 2))
    target = OUT / "og.png"
    card.convert("RGB").save(target, optimize=True)
    print(f"{target.name}: {width}x{height}, {target.stat().st_size / 1024:.0f} KB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for file, name in PICTURES.items():
        build(MOCKUPS / file, name)
    preview_card()
    icons()


if __name__ == "__main__":
    main()
