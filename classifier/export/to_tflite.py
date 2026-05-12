"""
Export the trained model to TensorFlow Lite (.tflite) for Android deployment.

Pipeline:
    PyTorch checkpoint → ONNX → TensorFlow SavedModel → TFLite (int8 quantized)

The output is a flat .tflite file that the Expo native module loads via
TensorFlow Lite Interpreter (react-native-fast-tflite or similar).

Input:  [1, 3, 224, 224] float32 (ImageNet normalized)
Output: [1, 3]           float32 (logits — apply softmax in app)

Usage:
    python export/to_tflite.py [--checkpoint weights/best.pt] [--quantize]
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent.parent))
import config as cfg
from train import build_model


def export(checkpoint_path: Path, quantize: bool = True):
    # ── Load model ──────────────────────────────────────────────────────────────
    print(f"Loading checkpoint: {checkpoint_path}")
    ckpt = torch.load(checkpoint_path, map_location="cpu")
    model = build_model()
    model.load_state_dict(ckpt["model"])
    model.eval()

    # ── Step 1: PyTorch → ONNX ──────────────────────────────────────────────────
    onnx_path = cfg.WEIGHTS_DIR / "best.onnx"
    if not onnx_path.exists():
        print("Exporting to ONNX...")
        dummy = torch.zeros(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)
        torch.onnx.export(
            model, dummy, str(onnx_path),
            input_names=["image"],
            output_names=["logits"],
            dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
            opset_version=17,
        )
        print(f"Saved: {onnx_path}")
    else:
        print(f"Using existing ONNX: {onnx_path}")

    # Simplify ONNX graph
    try:
        import onnxsim
        import onnx
        model_onnx = onnx.load(str(onnx_path))
        model_simplified, ok = onnxsim.simplify(model_onnx)
        if ok:
            onnx_path_sim = cfg.WEIGHTS_DIR / "best_simplified.onnx"
            onnx.save(model_simplified, str(onnx_path_sim))
            onnx_path = onnx_path_sim
            print(f"ONNX simplified: {onnx_path}")
    except ImportError:
        print("onnx-simplifier not installed — skipping simplification")

    # ── Step 2: ONNX → TensorFlow SavedModel ────────────────────────────────────
    try:
        from onnx_tf.backend import prepare
        import onnx

        print("\nConverting ONNX → TensorFlow SavedModel...")
        tf_model_path = cfg.WEIGHTS_DIR / "tf_savedmodel"
        onnx_model = onnx.load(str(onnx_path))
        tf_rep = prepare(onnx_model)
        tf_rep.export_graph(str(tf_model_path))
        print(f"SavedModel: {tf_model_path}")

    except ImportError:
        print("onnx-tf not installed. Install with: pip install onnx-tf tensorflow")
        print("Alternatively, use ai-edge-torch for direct PyTorch → TFLite conversion:")
        print("  pip install ai-edge-torch")
        print("  See: https://github.com/google-ai-edge/ai-edge-torch")
        _write_alternative_instructions(cfg.EXPORT_DIR)
        return

    # ── Step 3: TensorFlow SavedModel → TFLite ───────────────────────────────────
    try:
        import tensorflow as tf

        print("\nConverting TensorFlow SavedModel → TFLite...")
        converter = tf.lite.TFLiteConverter.from_saved_model(str(tf_model_path))

        if quantize:
            print("Applying int8 post-training quantization...")
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
            converter.inference_input_type  = tf.float32   # keep float input for simplicity
            converter.inference_output_type = tf.float32

            # Representative dataset for calibration
            def representative_dataset():
                for _ in range(200):
                    dummy_input = np.random.randn(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)
                    yield [dummy_input.astype(np.float32)]

            converter.representative_dataset = representative_dataset

        tflite_model = converter.convert()

        suffix = "_int8" if quantize else "_fp32"
        tflite_path = cfg.EXPORT_DIR / f"{cfg.TFLITE_MODEL_NAME}{suffix}.tflite"
        tflite_path.write_bytes(tflite_model)

        size_mb = tflite_path.stat().st_size / 1e6
        print(f"\n✓ Saved: {tflite_path}")
        print(f"  Size:    {size_mb:.1f} MB")
        print(f"  Classes: {cfg.CLASSES} (output index 0=clean, 1=suggestive, 2=explicit)")
        print(f"\nDrop {tflite_path.name} into apps/mobile/assets/models/ and wire up")
        print("the TFLite interpreter native module.")

    except ImportError:
        print("TensorFlow not installed. Run: pip install tensorflow>=2.16.0")
        return


def _write_alternative_instructions(export_dir: Path):
    """Write a helper script for the ai-edge-torch path."""
    script = export_dir / "to_tflite_aiedge.py"
    script.write_text("""
# Alternative: direct PyTorch → TFLite via ai-edge-torch (no TF/ONNX needed)
# pip install ai-edge-torch

import sys
from pathlib import Path
import torch
import ai_edge_torch

sys.path.insert(0, str(Path(__file__).parent.parent))
import config as cfg
from train import build_model

ckpt = torch.load(cfg.WEIGHTS_DIR / "best.pt", map_location="cpu")
model = build_model()
model.load_state_dict(ckpt["model"])
model.eval()

sample_input = (torch.randn(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE),)
edge_model = ai_edge_torch.convert(model, sample_input)
edge_model.export(str(cfg.EXPORT_DIR / f"{cfg.TFLITE_MODEL_NAME}.tflite"))
print("Done — ai-edge-torch export complete")
""")
    print(f"\nAlternative ai-edge-torch script written to: {script}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default=str(cfg.WEIGHTS_DIR / "best.pt"))
    parser.add_argument("--no-quantize", action="store_true")
    args = parser.parse_args()

    export(
        checkpoint_path=Path(args.checkpoint),
        quantize=not args.no_quantize,
    )


if __name__ == "__main__":
    main()
