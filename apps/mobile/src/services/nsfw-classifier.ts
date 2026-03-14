import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as nsfwjs from 'nsfwjs';
import { File as ExpoFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { NSFW_THRESHOLDS } from '@quenchr/shared';
import type {
  NSFWCategory,
  ClassificationResult,
  RegionResult,
  AuditImageResult,
} from '@quenchr/shared';

// ── Types ──

export interface ScanProgress {
  phase: 'initializing' | 'segmenting' | 'classifying' | 'complete';
  currentImage: number;
  totalImages: number;
  currentRegion: number;
  totalRegions: number;
  percentComplete: number;
}

// ── Module State ──

let model: nsfwjs.NSFWJS | null = null;
let initPromise: Promise<void> | null = null;

const MODEL_URL = 'https://nsfwjs.com/quant_nsfw_mobilenet/';

// ── Public API ──

/**
 * Initialize TensorFlow.js and load the NSFWJS model.
 * Safe to call multiple times — subsequent calls await the first init.
 */
export async function initializeModel(
  onProgress?: (phase: string) => void
): Promise<void> {
  if (model) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      onProgress?.('Initializing TensorFlow...');
      await tf.ready();
      console.log('[nsfw-classifier] TF.js ready, backend:', tf.getBackend());

      onProgress?.('Loading NSFW model...');
      model = await nsfwjs.load(MODEL_URL, { size: 224 });
      console.log('[nsfw-classifier] Model loaded');

      onProgress?.('Model ready');
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  await initPromise;
}

export function isModelLoaded(): boolean {
  return model !== null;
}

/**
 * Scan an array of screenshot URIs through the NSFW classification pipeline.
 *
 * Pipeline per image:
 *   1. Crop into 3x4 grid (12 regions)
 *   2. Classify each region with NSFWJS
 *   3. Aggregate results
 */
export async function scanImages(
  imageUris: string[],
  onProgress: (progress: ScanProgress) => void
): Promise<{
  imageResults: AuditImageResult[];
  allClassifications: ClassificationResult[];
}> {
  if (!model) throw new Error('Model not initialized. Call initializeModel() first.');

  const cols = NSFW_THRESHOLDS.gridColumns;
  const rows = NSFW_THRESHOLDS.gridRows;
  const regionsPerImage = cols * rows;
  const totalRegions = imageUris.length * regionsPerImage;
  let processedRegions = 0;

  const imageResults: AuditImageResult[] = [];
  const allClassifications: ClassificationResult[] = [];

  for (let imgIdx = 0; imgIdx < imageUris.length; imgIdx++) {
    onProgress({
      phase: 'segmenting',
      currentImage: imgIdx + 1,
      totalImages: imageUris.length,
      currentRegion: processedRegions,
      totalRegions,
      percentComplete: Math.round((processedRegions / totalRegions) * 100),
    });

    // Crop into grid regions
    const regions = await segmentImageIntoGrid(imageUris[imgIdx], cols, rows);
    const regionResults: RegionResult[] = [];

    for (let regIdx = 0; regIdx < regions.length; regIdx++) {
      processedRegions++;
      onProgress({
        phase: 'classifying',
        currentImage: imgIdx + 1,
        totalImages: imageUris.length,
        currentRegion: processedRegions,
        totalRegions,
        percentComplete: Math.round((processedRegions / totalRegions) * 100),
      });

      const region = regions[regIdx];
      let classification: ClassificationResult;

      try {
        classification = await classifyRegion(region.uri);
      } catch {
        // Graceful fallback — treat failed region as neutral
        classification = { category: 'neutral', confidence: 0 };
      }

      regionResults.push({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        classification,
      });

      allClassifications.push(classification);
    }

    // Per-image suggestive percentage
    const suggestiveCount = regionResults.filter(
      (r) =>
        (NSFW_THRESHOLDS.suggestiveCategories as readonly string[]).includes(
          r.classification.category
        ) && r.classification.confidence >= NSFW_THRESHOLDS.suggestive
    ).length;

    imageResults.push({
      image_index: imgIdx,
      regions: regionResults,
      suggestive_percentage: Math.round((suggestiveCount / regionResults.length) * 100),
    });
  }

  onProgress({
    phase: 'complete',
    currentImage: imageUris.length,
    totalImages: imageUris.length,
    currentRegion: totalRegions,
    totalRegions,
    percentComplete: 100,
  });

  return { imageResults, allClassifications };
}

// ── Internal Helpers ──

interface CroppedRegion {
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

async function segmentImageIntoGrid(
  imageUri: string,
  cols: number,
  rows: number
): Promise<CroppedRegion[]> {
  // Get image dimensions via a no-op manipulate
  const info = await ImageManipulator.manipulateAsync(imageUri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const imgWidth = info.width;
  const imgHeight = info.height;

  const cellWidth = Math.floor(imgWidth / cols);
  const cellHeight = Math.floor(imgHeight / rows);

  const regions: CroppedRegion[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellWidth;
      const y = row * cellHeight;

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX: x, originY: y, width: cellWidth, height: cellHeight } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );

      regions.push({ uri: cropped.uri, x, y, width: cellWidth, height: cellHeight });
    }
  }

  return regions;
}

async function classifyRegion(regionUri: string): Promise<ClassificationResult> {
  // Read file as ArrayBuffer, convert to Uint8Array for JPEG decoding
  const file = new ExpoFile(regionUri);
  const arrayBuffer = await file.arrayBuffer();
  const imageTensor = decodeJpeg(new Uint8Array(arrayBuffer));

  try {
    const predictions = await model!.classify(imageTensor as tf.Tensor3D);

    // Top prediction
    const top = predictions.reduce((a, b) => (a.probability > b.probability ? a : b));

    return {
      category: top.className.toLowerCase() as NSFWCategory,
      confidence: top.probability,
    };
  } finally {
    imageTensor.dispose();
  }
}

/**
 * Decode JPEG bytes into a 3D tensor.
 * Uses tf.node.decodeJpeg if available, otherwise manual decode.
 */
function decodeJpeg(bytes: Uint8Array): tf.Tensor3D {
  // @tensorflow/tfjs-react-native provides this on the tf.env()
  // Use the platform-provided decoder
  const tfRN = require('@tensorflow/tfjs-react-native');
  if (typeof tfRN.decodeJpeg === 'function') {
    return tfRN.decodeJpeg(bytes);
  }

  // Fallback: use jpeg-js for pure-JS decoding
  const jpeg = require('jpeg-js');
  const { data, width, height } = jpeg.decode(bytes, { useTArray: true });

  // data is RGBA, we need RGB
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }

  return tf.tensor3d(rgb, [height, width, 3], 'int32');
}
