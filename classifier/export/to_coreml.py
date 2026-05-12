"""
Export the trained model to CoreML (.mlpackage) for iOS deployment.

The output is an MLModel that accepts a 224×224 RGB image and returns:
  - classLabel:       str  ("clean" | "suggestive" | "explicit")
  - classProbability: dict {class: float}

This plugs directly into the Expo native module via Vision framework.

Usage:
    python export/to_coreml.py [--checkpoint weights/best.pt] [--quantize]
"""

import argparse
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent.parent))
import config as cfg
from train import build_model


def export(checkpoint_path: Path, quantize: bool = True):
    device = torch.device("cpu")  # CoreML export must be on CPU

    # ── Load model ──────────────────────────────────────────────────────────────
    print(f"Loading checkpoint: {checkpoint_path}")
    ckpt = torch.load(checkpoint_path, map_location=device)
    model = build_model()
    model.load_state_dict(ckpt["model"])
    model.eval()

    # ── Trace ───────────────────────────────────────────────────────────────────
    dummy = torch.zeros(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)
    traced = torch.jit.trace(model, dummy)
    print("TorchScript trace complete")

    # ── Convert ─────────────────────────────────────────────────────────────────
    try:
        import coremltools as ct
    except ImportError:
        print("ERROR: coremltools not installed. Run: pip install coremltools>=8.0.0")
        sys.exit(1)

    # Image input with standard ImageNet preprocessing baked in
    image_input = ct.ImageType(
        name="image",
        shape=(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE),
        scale=1.0 / (0.229 * 255.0),   # ImageNet norm baked in
        bias=[-0.485 / 0.229, -0.456 / 0.224, -0.406 / 0.225],
        color_layout=ct.colorlayout.RGB,
    )

    print("Converting to CoreML...")
    mlmodel = ct.convert(
        traced,
        inputs=[image_input],
        classifier_config=ct.ClassifierConfig(cfg.CLASSES),
        convert_to="mlprogram",          # .mlpackage format (iOS 15+)
        minimum_deployment_target=ct.target.iOS15,
        compute_precision=ct.precision.FLOAT16,
    )

    # ── Metadata ─────────────────────────────────────────────────────────────────
    mlmodel.short_description = "Quenchr content classifier — clean / suggestive / explicit"
    mlmodel.author = "Quenchr"
    mlmodel.version = ckpt.get("epoch", "1.0")
    mlmodel.input_description["image"]  = "224×224 RGB feed frame"
    mlmodel.output_description["classLabel"]        = "Top predicted class"
    mlmodel.output_description["classProbability"]  = "Per-class confidence scores"

    # ── Int8 quantization (optional — ~4× smaller, <1% accuracy drop) ────────────
    if quantize:
        print("Applying int8 post-training quantization...")
        from coremltools.optimize.coreml import (
            OpLinearQuantizerConfig, OptimizationConfig, linear_quantize_weights
        )
        op_config = OpLinearQuantizerConfig(mode="linear_symmetric", dtype="int8")
        config = OptimizationConfig(global_config=op_config)
        mlmodel = linear_quantize_weights(mlmodel, config=config)
        print("Quantization applied")

    # ── Save ─────────────────────────────────────────────────────────────────────
    out_path = cfg.EXPORT_DIR / f"{cfg.COREML_MODEL_NAME}.mlpackage"
    mlmodel.save(str(out_path))

    size_mb = sum(f.stat().st_size for f in out_path.rglob("*") if f.is_file()) / 1e6
    print(f"\n✓ Saved: {out_path}")
    print(f"  Size:    {size_mb:.1f} MB")
    print(f"  Classes: {cfg.CLASSES}")
    print(f"\nDrop {out_path.name} into apps/mobile/assets/models/ and wire up the")
    print("Vision framework native module to call it.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default=str(cfg.WEIGHTS_DIR / "best.pt"))
    parser.add_argument("--no-quantize", action="store_true",
                        help="Skip int8 quantization (larger model, slightly higher accuracy)")
    args = parser.parse_args()

    export(
        checkpoint_path=Path(args.checkpoint),
        quantize=not args.no_quantize,
    )


if __name__ == "__main__":
    main()
