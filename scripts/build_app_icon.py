"""Draw Gospel's app icon.

The mark is a plate read as a graduated measure: a ring, filled from the
bottom to a level, and a rule running the full width of the tile that meets
the circle exactly at that level. It is the app's own argument in one shape -
a meal is a quantity, and the point of the plan is the moment the quantity
arrives at its line.

It is drawn rather than painted, in the same two greys the interface uses and
no others, because the interface has no colour and an icon that did would be
lying about what is behind it. That constraint also makes the Android
monochrome variant free: the mark is already one colour.

Everything is supersampled 4x and reduced with Lanczos, which is what gives
the ring a clean edge at 48 px without hinting it by hand.

Run:  python scripts/build_app_icon.py
Out:  assets/icon.png                     1024, opaque - iOS and Expo Go
      assets/android-icon-foreground.png  1024, transparent, inside the safe zone
      assets/android-icon-monochrome.png  1024, transparent - Android 13 themed
      assets/splash-icon.png               512, transparent
      assets/favicon.png                    96, opaque
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# The two greys are grade[0] and grade[96] from src/theme/tokens.ts; the ground
# is app.json's backgroundColor, which is what the splash and the adaptive icon
# background are already set to.
GROUND = (8, 9, 11, 255)      # #08090B
INK = (241, 241, 241, 255)    # grade[96]
RULE = (144, 144, 144, 255)   # grade[70]

SS = 4  # supersample factor

# Proportions of the tile, so every output size is the same drawing.
RADIUS = 0.315       # ring radius
RING = 0.0270        # ring stroke
LEVEL = 0.464        # fill surface, as a fraction of height from the top
RULE_WEIGHT = 0.0140


def draw_mark(size: int, *, ground: tuple | None, scale: float = 1.0,
              ink: tuple = INK, rule: tuple | None = RULE) -> Image.Image:
    """The mark on a tile of `size`, at `scale` of its natural size."""
    big = size * SS
    canvas = Image.new("RGBA", (big, big), ground or (0, 0, 0, 0))

    centre = big / 2
    radius = RADIUS * big * scale
    ring = max(RING * big * scale, 1.0)
    level = centre - (0.5 - LEVEL) * big * scale
    box = (centre - radius, centre - radius, centre + radius, centre + radius)

    # The disc, used both to fill the lower segment and to keep the rule from
    # crossing the circle.
    disc = Image.new("L", (big, big), 0)
    ImageDraw.Draw(disc).ellipse(box, fill=255)

    # The rule runs the full width and stops at the circle, so it reads as
    # entering the plate and becoming the surface of what is in it.
    if rule is not None:
        band = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        ImageDraw.Draw(band).rectangle(
            (0, level - RULE_WEIGHT * big * scale / 2,
             big, level + RULE_WEIGHT * big * scale / 2),
            fill=rule,
        )
        band.putalpha(Image.composite(
            Image.new("L", (big, big), 0), band.getchannel("A"), disc))
        canvas.alpha_composite(band)

    # The fill: the disc, below the level.
    below = Image.new("L", (big, big), 0)
    ImageDraw.Draw(below).rectangle((0, level, big, big), fill=255)
    fill = Image.new("RGBA", (big, big), ink)
    fill.putalpha(Image.composite(disc, Image.new("L", (big, big), 0), below))
    canvas.alpha_composite(fill)

    # The ring last, so it closes over the fill's cut edges.
    ImageDraw.Draw(canvas).ellipse(box, outline=ink, width=int(round(ring)))

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    ASSETS.mkdir(exist_ok=True)

    written: list[tuple[str, int]] = []

    def save(image: Image.Image, name: str, *, flatten: bool = False) -> None:
        path = ASSETS / name
        if flatten:
            ground = Image.new("RGBA", image.size, GROUND)
            ground.alpha_composite(image)
            image = ground.convert("RGB")
        image.save(path)
        written.append((name, path.stat().st_size))

    # iOS and Expo Go: opaque, edge to edge.
    save(draw_mark(1024, ground=GROUND), "icon.png")

    # Android adaptive: the launcher masks the outer ~17% to whatever shape the
    # device uses, so the ring is scaled to sit inside the safe zone. The rule
    # is allowed to run out to the edge and be clipped - it is the one part of
    # the mark that reads the same cut off.
    save(draw_mark(1024, ground=None, scale=0.66), "android-icon-foreground.png")

    # Android 13 themed icons are tinted by the system, so this ships the mark
    # as one flat colour with the rule dropped - a two-tone monochrome layer
    # comes back from the tinting as a single muddy shape.
    save(draw_mark(1024, ground=None, scale=0.66, ink=(255, 255, 255, 255),
                   rule=None), "android-icon-monochrome.png")

    save(draw_mark(512, ground=None), "splash-icon.png")
    save(draw_mark(96, ground=GROUND), "favicon.png", flatten=False)

    for name, size in written:
        print(f"  {name:<32} {size / 1024:6.1f} kB")


if __name__ == "__main__":
    main()
