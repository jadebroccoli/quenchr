"""
Run the best checkpoint against the held-out test set.

Outputs:
  - Per-class precision / recall / F1
  - Confusion matrix (console + PNG saved to weights/)
  - Per-threshold analysis for the 'suggestive' class (helps tune
    the CALIBRATION_ZONE thresholds in config.py)

Usage:
    python evaluate.py [--checkpoint weights/best.pt] [--split test]
"""

import argparse
import sys
from pathlib import Path

import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from tqdm import tqdm
from sklearn.metrics import classification_report

sys.path.insert(0, str(Path(__file__).parent))
import config as cfg
from train import build_model
from data.dataset import get_dataset, get_val_transform
from torch.utils.data import DataLoader


def evaluate(checkpoint_path: Path, split: str = "test"):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Checkpoint: {checkpoint_path}")
    print(f"Split: {split}")

    # ── Model ────────────────────────────────────────────────────────────────────
    ckpt = torch.load(checkpoint_path, map_location=device)
    model = build_model().to(device)
    model.load_state_dict(ckpt["model"])
    model.eval()

    # ── Data ─────────────────────────────────────────────────────────────────────
    dataset = get_dataset(split)
    loader = DataLoader(
        dataset,
        batch_size=cfg.BATCH_SIZE * 2,
        shuffle=False,
        num_workers=cfg.NUM_WORKERS,
        pin_memory=cfg.PIN_MEMORY,
    )

    # ── Inference ────────────────────────────────────────────────────────────────
    all_probs   = []
    all_preds   = []
    all_labels  = []

    with torch.no_grad():
        for images, labels in tqdm(loader, desc="Evaluating"):
            images = images.to(device, non_blocking=True)
            logits = model(images)
            probs  = F.softmax(logits, dim=1)

            all_probs.append(probs.cpu())
            all_preds.append(probs.argmax(dim=1).cpu())
            all_labels.append(labels)

    all_probs  = torch.cat(all_probs).numpy()
    all_preds  = torch.cat(all_preds).numpy()
    all_labels = torch.cat(all_labels).numpy()

    # ── Classification report ────────────────────────────────────────────────────
    print("\n" + "="*60)
    print(f"Classification Report ({split} set, n={len(all_labels):,})")
    print("="*60)
    print(classification_report(all_labels, all_preds,
                                 target_names=cfg.CLASSES, digits=4))

    # ── Confusion matrix ─────────────────────────────────────────────────────────
    from sklearn.metrics import confusion_matrix
    cm = confusion_matrix(all_labels, all_preds)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=cfg.CLASSES, yticklabels=cfg.CLASSES, ax=ax1)
    ax1.set_title("Confusion Matrix (counts)")
    ax1.set_ylabel("True label"); ax1.set_xlabel("Predicted label")

    sns.heatmap(cm_norm, annot=True, fmt=".2%", cmap="Blues",
                xticklabels=cfg.CLASSES, yticklabels=cfg.CLASSES, ax=ax2)
    ax2.set_title("Confusion Matrix (normalised)")
    ax2.set_ylabel("True label"); ax2.set_xlabel("Predicted label")

    plt.tight_layout()
    out_png = cfg.WEIGHTS_DIR / f"confusion_matrix_{split}.png"
    plt.savefig(out_png, dpi=150)
    print(f"\nConfusion matrix saved: {out_png}")

    # ── Calibration zone analysis ────────────────────────────────────────────────
    # Show what fraction of predictions fall in the ambiguous zone
    # This informs CALIBRATION_ZONE thresholds in config.py
    print("\n─── Calibration zone analysis ────────────────────────────")
    print(f"(Zone = model confidence between {cfg.CALIBRATION_ZONE[0]} and {cfg.CALIBRATION_ZONE[1]})")
    for class_idx, class_name in enumerate(cfg.CLASSES):
        class_probs = all_probs[:, class_idx]
        in_zone = (class_probs >= cfg.CALIBRATION_ZONE[0]) & \
                  (class_probs <= cfg.CALIBRATION_ZONE[1])
        top_class = all_probs.argmax(axis=1) == class_idx
        ambiguous = in_zone & top_class
        pct = ambiguous.mean() * 100
        print(f"  {class_name:12s}  {ambiguous.sum():5,} / {top_class.sum():5,} "
              f"predictions in ambiguous zone ({pct:.1f}%)")
    print("──────────────────────────────────────────────────────────")
    print("\nHigher ambiguous % = more room for per-user calibration to matter.")
    print("If suggestive ambiguous % < 20%, consider widening CALIBRATION_ZONE in config.py.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default=str(cfg.WEIGHTS_DIR / "best.pt"))
    parser.add_argument("--split", default="test", choices=["train", "val", "test"])
    args = parser.parse_args()

    evaluate(Path(args.checkpoint), args.split)


if __name__ == "__main__":
    main()
