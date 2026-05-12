"""
Merge, deduplicate, balance, and split the raw downloaded images into
train / val / test sets that PyTorch's ImageFolder can read directly.

Output structure:
    data/split/
        train/
            clean/       *.jpg
            suggestive/  *.jpg
            explicit/    *.jpg
        val/
            clean/  ...
            suggestive/ ...
            explicit/  ...
        test/
            clean/  ...
            suggestive/ ...
            explicit/  ...

Run after download.py:
    python -m data.prepare [--balance] [--augment-minority]
"""

import argparse
import hashlib
import logging
import random
import shutil
import sys
from pathlib import Path

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))
import config as cfg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


# ── Helpers ─────────────────────────────────────────────────────────────────────

def file_hash(path: Path) -> str:
    """MD5 of first 8KB — fast near-duplicate detection."""
    with open(path, "rb") as f:
        return hashlib.md5(f.read(8192)).hexdigest()


def collect_images(src_dir: Path) -> list[Path]:
    return [p for p in src_dir.rglob("*") if p.suffix.lower() in SUPPORTED_EXTS]


def deduplicate(paths: list[Path]) -> list[Path]:
    """Remove exact/near-duplicate files by content hash."""
    seen, unique = set(), []
    for p in tqdm(paths, desc=f"Deduping {p.parent.name if paths else ''}"):
        try:
            h = file_hash(p)
        except Exception:
            continue
        if h not in seen:
            seen.add(h)
            unique.append(p)
    return unique


def validate_image(path: Path) -> bool:
    """Check image can be opened and is large enough to be useful."""
    try:
        from PIL import Image
        with Image.open(path) as img:
            w, h = img.size
            return w >= 100 and h >= 100 and img.mode in ("RGB", "RGBA", "L")
    except Exception:
        return False


def copy_to_split(paths: list[Path], label: str, split: str):
    dest_dir = cfg.SPLIT_DIR / split / label
    dest_dir.mkdir(parents=True, exist_ok=True)
    for p in tqdm(paths, desc=f"  {split}/{label}"):
        shutil.copy2(p, dest_dir / p.name)


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--balance", action="store_true",
                        help="Undersample majority classes to match the smallest class")
    parser.add_argument("--max-per-class", type=int, default=None,
                        help="Hard cap per class before splitting")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    log.info(f"Source:      {cfg.DATA_DIR}")
    log.info(f"Destination: {cfg.SPLIT_DIR}")

    all_class_images: dict[str, list[Path]] = {}

    for label in cfg.CLASSES:
        src = cfg.DATA_DIR / label
        if not src.exists():
            log.warning(f"No images found for class '{label}' at {src} — skipping")
            all_class_images[label] = []
            continue

        log.info(f"\nProcessing '{label}'...")
        images = collect_images(src)
        log.info(f"  Found:        {len(images):,}")

        images = deduplicate(images)
        log.info(f"  After dedup:  {len(images):,}")

        log.info("  Validating images (this may take a moment)...")
        images = [p for p in tqdm(images, desc="  Validating") if validate_image(p)]
        log.info(f"  After validate: {len(images):,}")

        if args.max_per_class:
            random.shuffle(images)
            images = images[:args.max_per_class]
            log.info(f"  After cap:    {len(images):,}")

        all_class_images[label] = images

    # ── Balance ──────────────────────────────────────────────────────────────────
    if args.balance:
        min_count = min(len(v) for v in all_class_images.values() if v)
        log.info(f"\nBalancing to {min_count:,} images per class")
        for label in cfg.CLASSES:
            imgs = all_class_images[label]
            if len(imgs) > min_count:
                random.shuffle(imgs)
                all_class_images[label] = imgs[:min_count]

    # ── Train / Val / Test split ─────────────────────────────────────────────────
    log.info("\nSplitting into train/val/test...")

    for label, images in all_class_images.items():
        if not images:
            log.warning(f"  Skipping '{label}' — no valid images")
            continue

        random.shuffle(images)
        n = len(images)
        n_test = max(1, int(n * cfg.TEST_FRACTION))
        n_val  = max(1, int(n * cfg.VAL_FRACTION))
        n_train = n - n_test - n_val

        train_imgs = images[:n_train]
        val_imgs   = images[n_train:n_train + n_val]
        test_imgs  = images[n_train + n_val:]

        log.info(f"  {label:12s}  train={len(train_imgs):,}  val={len(val_imgs):,}  test={len(test_imgs):,}")

        copy_to_split(train_imgs, label, "train")
        copy_to_split(val_imgs,   label, "val")
        copy_to_split(test_imgs,  label, "test")

    # ── Summary ──────────────────────────────────────────────────────────────────
    log.info("\n─── Split summary ──────────────────────────────────────")
    for split in ["train", "val", "test"]:
        totals = {}
        for label in cfg.CLASSES:
            d = cfg.SPLIT_DIR / split / label
            totals[label] = len(list(d.glob("*"))) if d.exists() else 0
        total = sum(totals.values())
        log.info(f"  {split:6s}  " + "  ".join(f"{l}={n:,}" for l, n in totals.items()) +
                 f"  (total {total:,})")
    log.info("────────────────────────────────────────────────────────")
    log.info("Next step: python train.py")


if __name__ == "__main__":
    main()
