import { File as ExpoFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@quenchr/supabase-client';
import type { Platform } from '@quenchr/shared';
import { useSettingsStore } from '../stores/settings-store';

// ── Constants ──

const HAIKU_IMAGE_WIDTH = 512;
const HAIKU_IMAGE_QUALITY = 0.7;
const FUNCTION_NAME = 'haiku-scan';

// ── Types ──

export interface HaikuFrameClassification {
  frame_index: number;
  suggestive_score: number;
  category: string;
  content_type: string;
  description: string;
}

export interface HaikuScanResult {
  classifications: HaikuFrameClassification[];
  overall_score: number;
  suggestive_percent: number;
  category_counts: {
    clean: number;
    mild: number;
    suggestive: number;
    explicit: number;
  };
  total_frames: number;
}

// ── Public API ──

/**
 * Run a Haiku vision scan on the given frame URIs.
 *
 * Converts each frame to a compressed base64 JPEG (512px width, 0.7 quality),
 * sends them to the `haiku-scan` Supabase Edge Function, and returns
 * per-frame classifications with an overall score.
 */
export async function scanWithHaiku(
  frameUris: string[],
  platform: Platform,
): Promise<HaikuScanResult> {
  // Convert all frames to base64 in parallel
  const frames = await Promise.all(
    frameUris.map(async (uri, index) => ({
      frame_index: index,
      image_base64: await imageUriToBase64(uri),
    })),
  );

  // Call the Supabase Edge Function
  const devMode = useSettingsStore.getState().devMode;
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: {
      frames,
      platform,
      mode: 'full' as const,
    },
    headers: devMode ? { 'x-quenchr-dev-mode': 'true' } : undefined,
  });

  if (error) {
    throw new Error(`Haiku scan failed: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error ?? 'Unknown Haiku scan error');
  }

  return data.data as HaikuScanResult;
}

// ── Internal Helpers ──

/**
 * Convert a local image URI to a compressed base64 JPEG string.
 * Resizes to 512px width to control payload size.
 */
async function imageUriToBase64(uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: HAIKU_IMAGE_WIDTH } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: HAIKU_IMAGE_QUALITY },
  );

  const file = new ExpoFile(manipulated.uri);
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
