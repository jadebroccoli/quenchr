"""
Main training script for the Quenchr content classifier.

Two-phase training strategy:
  Phase 1 (5 epochs):  Backbone frozen, head only — fast convergence
  Phase 2 (20 epochs): Full fine-tune at 100x lower LR — precision tuning

Usage:
    python train.py [--resume weights/checkpoint.pt] [--no-wandb]

Outputs:
    weights/best.pt        — best val F1 checkpoint
    weights/last.pt        — final epoch checkpoint
    weights/best.onnx      — ONNX export of the best checkpoint (for TFLite conversion)
"""

import argparse
import time
from pathlib import Path
import sys

import torch
import torch.nn as nn
from torch.cuda.amp import GradScaler
import timm
from torchmetrics.classification import MulticlassF1Score, MulticlassConfusionMatrix

sys.path.insert(0, str(Path(__file__).parent))
import config as cfg
from data.dataset import get_loaders, get_class_weights

# ── Optional W&B ────────────────────────────────────────────────────────────────
try:
    import wandb
    WANDB_AVAILABLE = True
except ImportError:
    WANDB_AVAILABLE = False


# ── Model ────────────────────────────────────────────────────────────────────────

def build_model() -> nn.Module:
    """EfficientNet-B0 with a 3-class head."""
    model = timm.create_model(
        cfg.MODEL_NAME,
        pretrained=cfg.PRETRAINED,
        num_classes=cfg.NUM_CLASSES,
    )
    return model


def freeze_backbone(model: nn.Module):
    """Freeze all parameters except the classifier head."""
    for name, param in model.named_parameters():
        # timm EfficientNet uses 'classifier' for the final linear layer
        param.requires_grad = "classifier" in name


def unfreeze_all(model: nn.Module):
    for param in model.parameters():
        param.requires_grad = True


# ── Training loop ────────────────────────────────────────────────────────────────

def run_epoch(
    model: nn.Module,
    loader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    scaler: GradScaler | None,
    device: torch.device,
    phase: str = "train",
) -> tuple[float, float]:
    """
    Run one epoch. Returns (avg_loss, macro_f1).
    Set optimizer=None for eval phases.
    """
    is_train = optimizer is not None
    model.train(is_train)

    f1_metric = MulticlassF1Score(num_classes=cfg.NUM_CLASSES, average="macro").to(device)

    total_loss = 0.0
    amp_dtype = torch.bfloat16 if cfg.AMP_DTYPE == "bfloat16" else torch.float16

    for batch_idx, (images, labels) in enumerate(loader):
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        with torch.set_grad_enabled(is_train):
            with torch.autocast(device_type="cuda", dtype=amp_dtype):
                logits = model(images)
                loss = criterion(logits, labels)

        if is_train:
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), cfg.GRAD_CLIP)
            scaler.step(optimizer)
            scaler.update()

        total_loss += loss.item()
        f1_metric.update(logits.argmax(dim=1), labels)

        if is_train and batch_idx % 50 == 0:
            print(f"    [{batch_idx:4d}/{len(loader)}]  loss={loss.item():.4f}", flush=True)

    avg_loss = total_loss / len(loader)
    macro_f1 = f1_metric.compute().item()
    return avg_loss, macro_f1


# ── Main ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", type=str, default=None,
                        help="Path to checkpoint .pt to resume from")
    parser.add_argument("--no-wandb", action="store_true",
                        help="Disable W&B logging")
    args = parser.parse_args()

    # ── Setup ───────────────────────────────────────────────────────────────────
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU:    {torch.cuda.get_device_name(0)}")
        print(f"VRAM:   {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    use_wandb = WANDB_AVAILABLE and not args.no_wandb and cfg.WANDB_PROJECT
    if use_wandb:
        wandb.init(project=cfg.WANDB_PROJECT, entity=cfg.WANDB_ENTITY, config={
            "model": cfg.MODEL_NAME,
            "batch_size": cfg.BATCH_SIZE,
            "phase1_epochs": cfg.PHASE1_EPOCHS,
            "phase2_epochs": cfg.PHASE2_EPOCHS,
        })

    # ── Data ─────────────────────────────────────────────────────────────────────
    print("\nLoading datasets...")
    train_loader, val_loader, _ = get_loaders()
    class_weights = get_class_weights(train_loader.dataset).to(device)
    print(f"Class weights: {dict(zip(cfg.CLASSES, class_weights.tolist()))}")

    # ── Model & criterion ────────────────────────────────────────────────────────
    model = build_model().to(device)
    # torch.compile for ~20% speed gain on Blackwell (optional, skip if it causes issues)
    try:
        model = torch.compile(model)
        print("torch.compile() enabled")
    except Exception:
        print("torch.compile() not available — continuing without it")

    criterion = nn.CrossEntropyLoss(
        weight=class_weights,
        label_smoothing=cfg.LABEL_SMOOTHING,
    )
    scaler = GradScaler()

    best_f1   = 0.0
    start_epoch = 0

    # ── Resume ───────────────────────────────────────────────────────────────────
    if args.resume:
        ckpt = torch.load(args.resume, map_location=device)
        model.load_state_dict(ckpt["model"])
        best_f1 = ckpt.get("val_f1", 0.0)
        start_epoch = ckpt.get("epoch", 0)
        print(f"Resumed from {args.resume} (epoch {start_epoch}, val_f1={best_f1:.4f})")

    # ════════════════════════════════════════════════════════════════════════════
    # PHASE 1 — Head only
    # ════════════════════════════════════════════════════════════════════════════
    if start_epoch < cfg.PHASE1_EPOCHS:
        print(f"\n{'='*60}")
        print(f"PHASE 1 — Head only ({cfg.PHASE1_EPOCHS} epochs, lr={cfg.PHASE1_LR})")
        print(f"{'='*60}")
        freeze_backbone(model)

        optimizer = torch.optim.AdamW(
            filter(lambda p: p.requires_grad, model.parameters()),
            lr=cfg.PHASE1_LR,
            weight_decay=cfg.WEIGHT_DECAY,
        )
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=cfg.PHASE1_EPOCHS
        )

        for epoch in range(start_epoch, cfg.PHASE1_EPOCHS):
            t0 = time.time()
            train_loss, train_f1 = run_epoch(model, train_loader, criterion,
                                             optimizer, scaler, device, "train")
            val_loss, val_f1 = run_epoch(model, val_loader, criterion,
                                         None, None, device, "val")
            scheduler.step()

            elapsed = time.time() - t0
            print(f"\nEpoch {epoch+1:02d}/{cfg.PHASE1_EPOCHS} ({elapsed:.0f}s)")
            print(f"  Train  loss={train_loss:.4f}  f1={train_f1:.4f}")
            print(f"  Val    loss={val_loss:.4f}  f1={val_f1:.4f}")

            if val_f1 > best_f1:
                best_f1 = val_f1
                _save_checkpoint(model, optimizer, epoch + 1, val_f1,
                                 cfg.WEIGHTS_DIR / "best.pt")
                print(f"  ★ New best: val_f1={best_f1:.4f}")

            _save_checkpoint(model, optimizer, epoch + 1, val_f1,
                             cfg.WEIGHTS_DIR / "last.pt")

            if use_wandb:
                wandb.log({"phase": 1, "epoch": epoch+1,
                           "train/loss": train_loss, "train/f1": train_f1,
                           "val/loss": val_loss, "val/f1": val_f1, "lr": scheduler.get_last_lr()[0]})

    # ════════════════════════════════════════════════════════════════════════════
    # PHASE 2 — Full fine-tune
    # ════════════════════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print(f"PHASE 2 — Full fine-tune ({cfg.PHASE2_EPOCHS} epochs, lr={cfg.PHASE2_LR})")
    print(f"{'='*60}")
    unfreeze_all(model)

    # Load best phase-1 weights before starting phase 2
    best_ckpt = cfg.WEIGHTS_DIR / "best.pt"
    if best_ckpt.exists():
        ckpt = torch.load(best_ckpt, map_location=device)
        model.load_state_dict(ckpt["model"])
        print(f"Loaded best phase-1 weights (val_f1={ckpt.get('val_f1', 0):.4f})")

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg.PHASE2_LR,
        weight_decay=cfg.WEIGHT_DECAY,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=cfg.PHASE2_EPOCHS, eta_min=1e-7
    )

    for epoch in range(cfg.PHASE2_EPOCHS):
        t0 = time.time()
        train_loss, train_f1 = run_epoch(model, train_loader, criterion,
                                         optimizer, scaler, device, "train")
        val_loss, val_f1 = run_epoch(model, val_loader, criterion,
                                     None, None, device, "val")
        scheduler.step()

        elapsed = time.time() - t0
        print(f"\nEpoch {epoch+1:02d}/{cfg.PHASE2_EPOCHS} ({elapsed:.0f}s)")
        print(f"  Train  loss={train_loss:.4f}  f1={train_f1:.4f}")
        print(f"  Val    loss={val_loss:.4f}  f1={val_f1:.4f}")

        if val_f1 > best_f1:
            best_f1 = val_f1
            _save_checkpoint(model, optimizer, epoch + 1, val_f1,
                             cfg.WEIGHTS_DIR / "best.pt")
            print(f"  ★ New best: val_f1={best_f1:.4f}")

        _save_checkpoint(model, optimizer, epoch + 1, val_f1,
                         cfg.WEIGHTS_DIR / "last.pt")

        if use_wandb:
            wandb.log({"phase": 2, "epoch": epoch + cfg.PHASE1_EPOCHS + 1,
                       "train/loss": train_loss, "train/f1": train_f1,
                       "val/loss": val_loss, "val/f1": val_f1, "lr": scheduler.get_last_lr()[0]})

    # ── Export best weights to ONNX ──────────────────────────────────────────────
    print("\nExporting best checkpoint to ONNX...")
    best_ckpt = cfg.WEIGHTS_DIR / "best.pt"
    if best_ckpt.exists():
        ckpt = torch.load(best_ckpt, map_location=device)
        model.load_state_dict(ckpt["model"])

    model.eval()
    dummy = torch.randn(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE, device=device)
    onnx_path = cfg.WEIGHTS_DIR / "best.onnx"
    torch.onnx.export(
        model, dummy, str(onnx_path),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    print(f"Saved: {onnx_path}")
    print(f"\nTraining complete. Best val_f1={best_f1:.4f}")
    print(f"\nNext steps:")
    print(f"  1. python evaluate.py                  ← run on held-out test set")
    print(f"  2. python export/to_coreml.py           ← iOS .mlpackage")
    print(f"  3. python export/to_tflite.py           ← Android .tflite")

    if use_wandb:
        wandb.finish()


def _save_checkpoint(model, optimizer, epoch, val_f1, path: Path):
    torch.save({
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "epoch": epoch,
        "val_f1": val_f1,
        "classes": cfg.CLASSES,
        "model_name": cfg.MODEL_NAME,
        "image_size": cfg.IMAGE_SIZE,
    }, path)


if __name__ == "__main__":
    main()
