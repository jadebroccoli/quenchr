import { File as ExpoFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@quenchr/supabase-client';
import { AI_INSIGHTS_CONFIG } from '@quenchr/shared';
import type { AIInsightsResult, Platform } from '@quenchr/shared';
import { useSettingsStore } from '../stores/settings-store';

// ── Constants ──

const {
  suggestiveThreshold: SUGGESTIVE_THRESHOLD,
  maxFrames: MAX_FRAMES,
  imageWidth: IMAGE_WIDTH,
  imageQuality: IMAGE_QUALITY,
} = AI_INSIGHTS_CONFIG;

const FUNCTION_NAME = 'ai-feed-analysis';

// ── Public API ──

/** Minimal frame reference for AI insights — just needs index and score */
export interface FlaggedFrame {
  image_index: number;
  suggestive_percentage: number;
}

/**
 * Run AI-powered feed analysis on flagged frames.
 *
 * Converts frames to base64, sends to the Supabase Edge Function,
 * which proxies the call to Claude Haiku vision. Returns structured
 * AI insights for the Pro results screen.
 */
export async function analyzeWithAI(
  flaggedFrames: FlaggedFrame[],
  frameUris: string[],
  platform: Platform,
  feedScore: number,
  auditId?: string,
  devMode?: boolean,
): Promise<AIInsightsResult> {
  // Build base64 frames payload (parallel conversion for speed)
  const frames = await Promise.all(
    flaggedFrames.map(async (frame) => ({
      frame_index: frame.image_index,
      image_base64: await imageUriToBase64(frameUris[frame.image_index]),
      suggestive_percentage: frame.suggestive_percentage,
    }))
  );

  // Use passed devMode flag, fall back to store
  const isDevMode = devMode ?? useSettingsStore.getState().devMode;
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: {
      frames,
      platform,
      feed_score: feedScore,
      audit_id: auditId,
      dev_mode: isDevMode || undefined,
    },
    headers: isDevMode ? { 'x-quenchr-dev-mode': 'true' } : undefined,
  });

  if (error) {
    // Extract actual error body from FunctionsHttpError when possible
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        detail = body?.error ?? detail;
      }
    } catch { /* ignore parse failures */ }
    throw new Error(`AI analysis failed: ${detail}`);
  }

  if (!data?.success) {
    throw new Error(data?.error ?? 'Unknown AI analysis error');
  }

  return data.data as AIInsightsResult;
}

// ── Internal Helpers ──

/**
 * Convert a local image URI to a compressed base64 JPEG string.
 * Resizes to IMAGE_WIDTH to control payload size (~60-100KB per frame).
 */
async function imageUriToBase64(uri: string): Promise<string> {
  // Resize to control payload size
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: IMAGE_WIDTH } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: IMAGE_QUALITY }
  );

  // Read file as ArrayBuffer, convert to base64
  const file = new ExpoFile(manipulated.uri);
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
