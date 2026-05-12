"""
PyTorch Dataset and DataLoader factories for the Quenchr classifier.

Uses torchvision.datasets.ImageFolder so the train/val/test directories
produced by prepare.py work out of the box.
"""

import torch
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, transforms
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
import config as cfg


# ── Transforms ──────────────────────────────────────────────────────────────────

def get_train_transform() -> transforms.Compose:
    return transforms.Compose([
        transforms.RandomResizedCrop(cfg.IMAGE_SIZE, scale=cfg.AUG_SCALE),
        transforms.RandomHorizontalFlip(p=cfg.AUG_HFLIP_PROB),
        transforms.ColorJitter(**cfg.AUG_COLOR_JITTER),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),  # ImageNet stats
        transforms.RandomErasing(p=cfg.AUG_RANDOM_ERASE),
    ])


def get_val_transform() -> transforms.Compose:
    """Deterministic center-crop — no randomness for eval."""
    return transforms.Compose([
        transforms.Resize(int(cfg.IMAGE_SIZE * 1.14)),     # slight oversize
        transforms.CenterCrop(cfg.IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])


# ── Datasets ────────────────────────────────────────────────────────────────────

def get_dataset(split: str) -> datasets.ImageFolder:
    """
    Load a split (train/val/test) from data/split/<split>/.
    Classes are inferred from subdirectory names — must match cfg.CLASSES order.
    """
    root = cfg.SPLIT_DIR / split
    if not root.exists():
        raise FileNotFoundError(
            f"Split '{split}' not found at {root}. Run: python -m data.prepare"
        )
    transform = get_train_transform() if split == "train" else get_val_transform()
    ds = datasets.ImageFolder(root=str(root), transform=transform)

    # Verify class order matches cfg.CLASSES (critical for inference)
    if ds.classes != cfg.CLASSES:
        raise ValueError(
            f"Class order mismatch!\n"
            f"  Directory: {ds.classes}\n"
            f"  config.py:  {cfg.CLASSES}\n"
            f"  Ensure subdirectory names exactly match CLASSES in config.py."
        )

    return ds


def get_class_weights(dataset: datasets.ImageFolder) -> torch.Tensor:
    """
    Compute inverse-frequency class weights to handle imbalanced data.
    Passed to CrossEntropyLoss(weight=...) during training.
    """
    counts = torch.zeros(len(cfg.CLASSES))
    for _, label in dataset.samples:
        counts[label] += 1
    weights = 1.0 / counts.clamp(min=1)
    return weights / weights.sum() * len(cfg.CLASSES)  # normalise


def get_sampler(dataset: datasets.ImageFolder) -> WeightedRandomSampler:
    """
    WeightedRandomSampler — oversamples minority classes so each batch
    sees roughly equal class distribution regardless of dataset balance.
    """
    class_weights = get_class_weights(dataset)
    sample_weights = [class_weights[label] for _, label in dataset.samples]
    return WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(dataset),
        replacement=True,
    )


# ── DataLoaders ─────────────────────────────────────────────────────────────────

def get_loaders() -> tuple[DataLoader, DataLoader, DataLoader]:
    """
    Returns (train_loader, val_loader, test_loader).
    Train loader uses weighted sampling; val/test are sequential.
    """
    train_ds = get_dataset("train")
    val_ds   = get_dataset("val")
    test_ds  = get_dataset("test")

    train_loader = DataLoader(
        train_ds,
        batch_size=cfg.BATCH_SIZE,
        sampler=get_sampler(train_ds),
        num_workers=cfg.NUM_WORKERS,
        pin_memory=cfg.PIN_MEMORY,
        drop_last=True,
        persistent_workers=True,
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=cfg.BATCH_SIZE * 2,    # larger batch fine for eval (no grad)
        shuffle=False,
        num_workers=cfg.NUM_WORKERS,
        pin_memory=cfg.PIN_MEMORY,
        persistent_workers=True,
    )

    test_loader = DataLoader(
        test_ds,
        batch_size=cfg.BATCH_SIZE * 2,
        shuffle=False,
        num_workers=cfg.NUM_WORKERS,
        pin_memory=cfg.PIN_MEMORY,
        persistent_workers=True,
    )

    return train_loader, val_loader, test_loader
