from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "public" / "favicon.png"
target_dir = root / "build"
target_dir.mkdir(parents=True, exist_ok=True)

icon_sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

with Image.open(source) as image:
    rgba = image.convert("RGBA")

    for size in icon_sizes:
        resized = rgba.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(target_dir / f"icon_{size}.png", format="PNG")

    rgba.resize((512, 512), Image.Resampling.LANCZOS).save(target_dir / "icon.png", format="PNG")
    rgba.save(
        target_dir / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

print("Created platform icon source files in", target_dir)
