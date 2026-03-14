import { File as ExpoFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@quenchr/supabase-client';
import { AI_INSIGHTS_CONFIG } from '@quenchr/shared';
import type { AuditImageResult, AIInsightsResult, Platform } from '@quenchr/shared';

// ── Constants ──

const {
  suggestiveThreshold: SUGGESTIVE_THRESHOLD,
  maxFrames: MAX_FRAMES,
  imageWidth: IMAGE_WIDTH,
  imageQuality: IMAGE_QUALITY,
} = AI_INSIGHTS_CONFIG;

const FUNCTION_NAME = 'ai-feed-analysis';

// ── Public API ──

/**
 * Select the most suggestive frames from the NSFWJS results.
 * Sorted by suggestive_percentage descending, capped at MAX_FRAMES.
 */
export function selectFlaggedFrames(
  imageResults: AuditImageResult[]
): AuditImageResult[] {
  return imageResults
    .filter((r) => r.suggestive_percentage > SUGGESTIVE_THRESHOLD)
    .sort((a, b) => b.suggestive_percentage - a.suggestive_percentage)
    .slice(0, MAX_FRAMES);
}

/**
 * Run AI-powered feed analysis on flagged frames.
 *
 * Converts frames to base64, sends to the Supabase Edge Function,
 * which proxies the call to Claude Haiku vision. Returns structured
 * AI insights for the Pro results screen.
 *
 * @param flaggedFrames - Frames that passed the suggestive threshold
 * @param frameUris - Original image URIs (indexed by image_index)
 * @param platform - Platform being audited
 * @param feedScore - NSFWJS feed score
 * @param auditId - Optional ID of the persisted FeedAudit record
 */
export async function analyzeWithAI(
  flaggedFrames: AuditImageResult[],
  frameUris: string[],
  platform: Platform,
  feedScore: number,
  auditId?: string,
): Promise<AIInsightsResult> {
  // Build base64 frames payload (parallel conversion for speed)
  const frames = await Promise.all(
    flaggedFrames.map(async (frame) => ({
      frame_index: frame.image_index,
      image_base64: await imageUriToBase64(frameUris[frame.image_index]),
      suggestive_percentage: frame.suggestive_percentage,
    }))
  );

  // Call Supabase Edge Function (auth token auto-attached)
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: {
      frames,
      platform,
      feed_score: feedScore,
      audit_id: auditId,
    },
  });

  if (error) {
    throw new Error(`AI analysis failed: ${error.message}`);
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
