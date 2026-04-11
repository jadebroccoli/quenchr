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
/** Max frames to send to the edge function (matches server limit of 30) */
const MAX_FRAMES = 20;

export async function scanWithHaiku(
  frameUris: string[],
  platform: Platform,
): Promise<HaikuScanResult> {
  // Sample frames evenly if we have more than MAX_FRAMES
  // Live scan can extract hundreds of frames — we pick representative ones
  const sampled = sampleFrames(frameUris, MAX_FRAMES);

  // Convert sampled frames to base64 in parallel
  const frames = await Promise.all(
    sampled.map(async ({ uri, originalIndex }) => ({
      frame_index: originalIndex,
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
    // Supabase wraps non-2xx responses as FunctionsHttpError.
    // error.message is always the generic "Edge Function returned a non-2xx
    // status code" — unwrap the actual body to get our real error string
    // (e.g. "Free tier: 1 AI-powered scan per week") so quota checks work.
    let message = error.message;
    let status: number | undefined;
    try {
      const ctx = (error as any).context;
      status = ctx?.status;
      const body = await ctx?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // If body parse fails, fall back to generic message
    }
    console.error('[haiku-scan] invoke error:', status, message);
    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(data?.error ?? 'Unknown Haiku scan error');
  }

  return data.data as HaikuScanResult;
}

// ── Internal Helpers ──

/**
 * Evenly sample up to `max` frames from the full list.
 * Preserves original indices so Haiku results map back correctly.
 */
function sampleFrames(
  uris: string[],
  max: number,
): { uri: string; originalIndex: number }[] {
  if (uris.length <= max) {
    return uris.map((uri, i) => ({ uri, originalIndex: i }));
  }
  const step = uris.length / max;
  const sampled: { uri: string; originalIndex: number }[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.floor(i * step);
    sampled.push({ uri: uris[idx], originalIndex: idx });
  }
  return sampled;
}

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
