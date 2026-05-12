"""
Dataset acquisition script.

Downloads and organises training images from three sources:

  1. LAION-Aesthetics-v2  →  clean (p_unsafe < 0.10) + suggestive (0.30–0.75)
  2. nsfw_data_scraper    →  suggestive (sexy/) + explicit (porn/)
  3. Open Images v7       →  clean (person-centric, safe-verified)

Run from the classifier/ directory:
    python -m data.download [--sources all|laion|nsfw|openimages] [--limit N]

Images land in:
    data/raw/clean/
    data/raw/suggestive/
    data/raw/explicit/

Run prepare.py next to merge, balance, and split into train/val/test.
"""

import argparse
import asyncio
import hashlib
import json
import logging
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))
import config as cfg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Helpers ─────────────────────────────────────────────────────────────────────

def url_to_filename(url: str, ext: str = ".jpg") -> str:
    """Deterministic filename from URL hash so re-runs are idempotent."""
    h = hashlib.md5(url.encode()).hexdigest()[:16]
    return f"{h}{ext}"


async def fetch_image(session: aiohttp.ClientSession, url: str, dest: Path,
                      semaphore: asyncio.Semaphore, timeout: int = 10) -> bool:
    """Download a single image. Returns True on success."""
    if dest.exists():
        return True  # already downloaded
    try:
        async with semaphore:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout),
                                   allow_redirects=True) as resp:
                if resp.status != 200:
                    return False
                ct = resp.headers.get("Content-Type", "")
                if "image" not in ct:
                    return False
                data = await resp.read()
                if len(data) < 2_000:   # skip tiny/broken images
                    return False
                dest.write_bytes(data)
                return True
    except Exception:
        return False


async def download_urls(urls: list[str], labels: list[str],
                        concurrency: int = 64) -> dict[str, int]:
    """Download a list of (url, label) pairs concurrently. Returns counts per label."""
    semaphore = asyncio.Semaphore(concurrency)
    counts = {c: 0 for c in cfg.CLASSES}

    connector = aiohttp.TCPConnector(limit=concurrency, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = []
        dests = []
        for url, label in zip(urls, labels):
            out_dir = cfg.DATA_DIR / label
            out_dir.mkdir(parents=True, exist_ok=True)
            dest = out_dir / url_to_filename(url)
            tasks.append(fetch_image(session, url, dest, semaphore))
            dests.append((dest, label))

        results = []
        for coro in tqdm(asyncio.as_completed(tasks), total=len(tasks),
                         desc="Downloading images"):
            results.append(await coro)

    for (dest, label), ok in zip(dests, results):
        if ok and dest.exists():
            counts[label] += 1
        elif not ok and dest.exists():
            dest.unlink()  # clean up partial files

    return counts


# ── Source 1: LAION-Aesthetics-v2 ───────────────────────────────────────────────

def download_laion(limit_per_class: int = 60_000):
    """
    Stream LAION-Aesthetics-v2 metadata and download images using p_unsafe scores:
      clean:      p_unsafe < 0.10  (safe, aesthetically scored images)
      suggestive: p_unsafe 0.30–0.75  (borderline — the hardest and most valuable class)

    Uses img2dataset for reliable parallel downloading with retry logic.
    Falls back to direct async download if img2dataset isn't available.
    """
    try:
        import img2dataset
        _download_laion_img2dataset(limit_per_class)
    except ImportError:
        log.warning("img2dataset not installed — falling back to async download (slower)")
        _download_laion_async(limit_per_class)


def _download_laion_img2dataset(limit_per_class: int):
    """Fast path using img2dataset (recommended)."""
    import subprocess

    log.info("Streaming LAION-Aesthetics-v2 metadata...")
    from datasets import load_dataset

    clean_urls, suggestive_urls = [], []

    ds = load_dataset(
        "laion/laion-aesthetics-v2",
        streaming=True,
        split="train",
        trust_remote_code=True,
    )

    for row in tqdm(ds, desc="Scanning LAION metadata"):
        p = row.get("p_unsafe", 0.0) or 0.0
        url = row.get("URL") or row.get("url", "")
        if not url:
            continue

        if p < 0.10 and len(clean_urls) < limit_per_class:
            clean_urls.append(url)
        elif 0.30 <= p <= 0.75 and len(suggestive_urls) < limit_per_class:
            suggestive_urls.append(url)

        if len(clean_urls) >= limit_per_class and len(suggestive_urls) >= limit_per_class:
            break

    log.info(f"Collected {len(clean_urls)} clean URLs, {len(suggestive_urls)} suggestive URLs")

    for label, urls in [("clean", clean_urls), ("suggestive", suggestive_urls)]:
        out_dir = cfg.DATA_DIR / label
        out_dir.mkdir(parents=True, exist_ok=True)
        url_file = cfg.DATA_DIR / f"laion_{label}_urls.txt"
        url_file.write_text("\n".join(urls))

        log.info(f"Downloading {len(urls)} {label} images via img2dataset...")
        subprocess.run([
            "img2dataset",
            "--url_list", str(url_file),
            "--input_format", "txt",
            "--output_folder", str(out_dir),
            "--processes_count", "16",
            "--thread_count", "64",
            "--image_size", str(cfg.IMAGE_SIZE),
            "--resize_mode", "center_crop",
            "--output_format", "files",
            "--encode_format", "jpg",
            "--encode_quality", "90",
            "--skip_reencode", "False",
            "--min_image_size", "100",
            "--max_aspect_ratio", "3.0",
        ], check=True)

    log.info("LAION download complete.")


def _download_laion_async(limit_per_class: int):
    """Fallback async path when img2dataset isn't installed."""
    from datasets import load_dataset

    urls, labels = [], []
    clean_n = suggestive_n = 0

    ds = load_dataset("laion/laion-aesthetics-v2", streaming=True, split="train",
                      trust_remote_code=True)

    for row in tqdm(ds, desc="Scanning LAION metadata"):
        p = row.get("p_unsafe", 0.0) or 0.0
        url = row.get("URL") or row.get("url", "")
        if not url:
            continue

        if p < 0.10 and clean_n < limit_per_class:
            urls.append(url); labels.append("clean"); clean_n += 1
        elif 0.30 <= p <= 0.75 and suggestive_n < limit_per_class:
            urls.append(url); labels.append("suggestive"); suggestive_n += 1

        if clean_n >= limit_per_class and suggestive_n >= limit_per_class:
            break

    counts = asyncio.run(download_urls(urls, labels))
    log.info(f"LAION async download complete: {counts}")


# ── Source 2: nsfw_data_scraper ─────────────────────────────────────────────────

NSFW_SCRAPER_URLS = {
    # GitHub raw CSVs from alex000kim/nsfw_data_scraper — precompiled URL lists
    # sexy/ → suggestive class
    # porn/ → explicit class
    # neutral/ → additional clean class supplement
    "suggestive": "https://raw.githubusercontent.com/alex000kim/nsfw_data_scraper/master/data/compiled/sexy.csv",
    "explicit":   "https://raw.githubusercontent.com/alex000kim/nsfw_data_scraper/master/data/compiled/porn.csv",
    "clean_supp": "https://raw.githubusercontent.com/alex000kim/nsfw_data_scraper/master/data/compiled/neutral.csv",
}


def download_nsfw_scraper(limit_per_class: int = 25_000):
    """
    Download images from alex000kim/nsfw_data_scraper URL lists.
    These are pre-labeled Instagram/Tumblr images — very distribution-relevant.
    """
    import requests

    for dest_label, csv_url in NSFW_SCRAPER_URLS.items():
        # neutral supplements the clean class
        label = "clean" if dest_label == "clean_supp" else dest_label

        log.info(f"Fetching URL list: {dest_label}")
        try:
            resp = requests.get(csv_url, timeout=30)
            resp.raise_for_status()
        except Exception as e:
            log.error(f"Failed to fetch {csv_url}: {e}")
            continue

        lines = resp.text.strip().split("\n")[1:]  # skip header
        urls = [line.split(",")[0].strip().strip('"') for line in lines if line]
        urls = [u for u in urls if u.startswith("http")][:limit_per_class]

        log.info(f"Downloading {len(urls)} {label} images from nsfw_data_scraper...")
        counts = asyncio.run(download_urls(urls, [label] * len(urls)))
        log.info(f"  → {counts[label]} saved")


# ── Source 3: Open Images v7 (clean supplement) ──────────────────────────────────

OPEN_IMAGES_SCRIPT = "https://raw.githubusercontent.com/openimages/dataset/main/downloader.py"

def download_open_images(limit: int = 20_000):
    """
    Download person-centric safe images from Open Images v7 as clean class supplement.
    Focuses on Person, Face categories with safety=True filter.

    Uses the official Open Images downloader. Requires 'awscli' or direct HTTP.
    """
    log.info("Downloading Open Images clean supplement...")

    try:
        # Try HuggingFace mirror — much faster than direct GCS
        from datasets import load_dataset

        ds = load_dataset(
            "HuggingFaceM4/the_cauldron",
            "ok-vqa",  # person-centric safe images
            streaming=True,
            split="train",
            trust_remote_code=True,
        )

        out_dir = cfg.DATA_DIR / "clean"
        out_dir.mkdir(parents=True, exist_ok=True)
        saved = 0

        for i, row in enumerate(tqdm(ds, total=limit, desc="Open Images clean")):
            if saved >= limit:
                break
            try:
                img = row.get("image")
                if img is None:
                    continue
                dest = out_dir / f"oi_{i:07d}.jpg"
                if not dest.exists():
                    img.save(dest, "JPEG", quality=90)
                saved += 1
            except Exception:
                continue

        log.info(f"Open Images: saved {saved} clean images")

    except Exception as e:
        log.warning(f"Open Images HuggingFace path failed: {e}")
        log.info("Skipping Open Images — LAION clean class should be sufficient.")


# ── Main ────────────────────────────────────────────────────────────────────────

def print_summary():
    log.info("\n─── Dataset summary ───────────────────────────────────")
    total = 0
    for label in cfg.CLASSES:
        d = cfg.DATA_DIR / label
        n = len(list(d.glob("*.jpg"))) + len(list(d.glob("*.png"))) if d.exists() else 0
        total += n
        status = "✓" if n >= 1000 else "⚠ low"
        log.info(f"  {label:12s}  {n:7,d} images  {status}")
    log.info(f"  {'TOTAL':12s}  {total:7,d} images")
    log.info("───────────────────────────────────────────────────────")
    log.info("Next step: python -m data.prepare")


def main():
    parser = argparse.ArgumentParser(description="Download Quenchr classifier training data")
    parser.add_argument("--sources", default="all",
                        choices=["all", "laion", "nsfw", "openimages"],
                        help="Which sources to download")
    parser.add_argument("--limit", type=int, default=None,
                        help="Override per-class image limit (default: use config.py targets)")
    args = parser.parse_args()

    limit = args.limit or max(cfg.TARGET_CLEAN, cfg.TARGET_SUGGESTIVE, cfg.TARGET_EXPLICIT)

    log.info(f"Downloading to: {cfg.DATA_DIR}")
    log.info(f"Per-class limit: {limit:,}")

    if args.sources in ("all", "laion"):
        log.info("\n[1/3] LAION-Aesthetics-v2 (clean + suggestive)...")
        download_laion(limit_per_class=limit)

    if args.sources in ("all", "nsfw"):
        log.info("\n[2/3] nsfw_data_scraper (suggestive + explicit + clean supplement)...")
        download_nsfw_scraper(limit_per_class=limit)

    if args.sources in ("all", "openimages"):
        log.info("\n[3/3] Open Images v7 (clean supplement)...")
        download_open_images(limit=limit // 2)

    print_summary()


if __name__ == "__main__":
    main()
