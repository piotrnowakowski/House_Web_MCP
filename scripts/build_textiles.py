"""Brief: Generate original seamless textile and wood study maps for furniture.

Inputs: --output directory (default scripts/textiles). No network or environment.
Outputs: linen.png, jute.png, oak.png, mesh.png, paint.png; also public interior texture copies.
Usage (from project root): python scripts/build_textiles.py
"""
import argparse
import logging
import math
from pathlib import Path
import random
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('scripts/textiles'), help='Original PNG map output directory.')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    public = Path('public/models/interior/textiles')
    public.mkdir(parents=True, exist_ok=True)
    for kind in ['linen', 'jute', 'oak', 'mesh', 'paint']:
        image = Image.new('RGB', (256, 256))
        randomizer = random.Random(407)
        pixels = []
        for y in range(256):
            for x in range(256):
                noise = randomizer.uniform(-7, 7)
                if kind == 'oak':
                    value = 221 + 13 * math.sin(x * math.pi / 8 + 0.55 * math.sin(y * math.pi / 128)) + noise / 3
                elif kind == 'paint':
                    value = 253 + noise / 4
                elif kind == 'mesh':
                    value = 96 if x % 8 < 4 and y % 8 < 4 else 225 + noise
                else:
                    period = 4 if kind == 'linen' else 8
                    value = 222 + 15 * math.sin(x * math.pi * 2 / period) * math.cos(y * math.pi * 2 / period) + noise
                shade = max(0, min(255, round(value)))
                pixels.append((shade, shade, shade))
        image.putdata(pixels)
        image.save(args.output / f'{kind}.png')
        image.save(public / f'{kind}.png')
        logging.info('Built original %s texture', kind)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    main()
