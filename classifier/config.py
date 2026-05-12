"""
Central config for all training, data, and export parameters.
Change things here — don't scatter magic numbers through the scripts.
"""

from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent
DATA_DIR    = ROOT / "data" / "raw"          # downloaded images land here
SPLIT_DIR   = ROOT / "data" / "split"        # train/ val/ test/ after prepare.py
WEIGHTS_DIR = ROOT / "weights"               # checkpoints saved here
EXPORT_DIR  = ROOT / "export" / "artifacts"  # .mlpackage and .tflite land here

for d in [DATA_DIR, SPLIT_DIR, WEIGHTS_DIR, EXPORT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Classes ─────────────────────────────────────────────────────────────────────
# Must match the taxonomy used in haiku-scan and ai-feed-analysis
CLASSES     = ["clean", "suggestive", "explicit"]
NUM_CLASSES = len(CLASSES)

# ── Model ───────────────────────────────────────────────────────────────────────
MODEL_NAME      = "efficientnet_b0"   # ~14 MB quantized, 224x224, fast on mobile
IMAGE_SIZE      = 224
PRETRAINED      = True                # ImageNet weights as backbone

# ── Training ────────────────────────────────────────────────────────────────────
BATCH_SIZE      = 128                 # fits easily in 32 GB GDDR7 on 5090
NUM_WORKERS     = 8                   # parallel data loading
PIN_MEMORY      = True

# Phase 1 — head only (backbone frozen)
PHASE1_EPOCHS   = 5
PHASE1_LR       = 1e-3

# Phase 2 — full fine-tune (all layers unlocked)
PHASE2_EPOCHS   = 20
PHASE2_LR       = 1e-5

WEIGHT_DECAY    = 1e-4
LABEL_SMOOTHING = 0.1                 # reduces overconfidence
GRAD_CLIP       = 1.0

# Mixed precision — bfloat16 is more stable than float16 on Blackwell
AMP_DTYPE       = "bfloat16"

# ── Dataset targets ─────────────────────────────────────────────────────────────
# Rough target sample counts per class. Balance matters more than raw volume.
# You can always train on less and iterate; more is always better for explicit/suggestive.
TARGET_CLEAN        = 40_000
TARGET_SUGGESTIVE   = 30_000
TARGET_EXPLICIT     = 20_000          # harder to find, lower ceiling is fine

VAL_FRACTION        = 0.15            # 15% held out for validation
TEST_FRACTION       = 0.05            # 5% held out for final eval, never touched during training

# ── Augmentation ────────────────────────────────────────────────────────────────
# Applied to training set only. Val/test get deterministic center-crop only.
AUG_SCALE           = (0.7, 1.0)      # random resized crop range
AUG_HFLIP_PROB      = 0.5
AUG_COLOR_JITTER    = dict(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.05)
AUG_RANDOM_ERASE    = 0.1            # randomly erase 10% of images (regularisation)

# ── Calibration adapter (per-user personalization layer) ────────────────────────
# A tiny linear adapter that sits on top of the frozen base model.
# Trained on-device from user flagging events. Never replaces the base model.
ADAPTER_HIDDEN      = 0              # 0 = single linear layer (simplest, smallest)
# Confidence threshold below which the base model defers to the calibration layer
CALIBRATION_ZONE    = (0.25, 0.80)   # base model confidence range where user vote matters

# ── Export ──────────────────────────────────────────────────────────────────────
COREML_MODEL_NAME   = "QuenchrClassifier"
TFLITE_MODEL_NAME   = "quenchr_classifier"

# Quantization: int8 post-training quantization for ~4x size reduction on mobile
QUANTIZE_INT8       = True

# ── W&B experiment tracking (set to None to disable) ────────────────────────────
WANDB_PROJECT       = "quenchr-classifier"
WANDB_ENTITY        = None            # your W&B username/team
