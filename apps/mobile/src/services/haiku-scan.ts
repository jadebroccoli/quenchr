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

  // Pre-flight: confirm session exists and log diagnostics
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  console.log('[haiku-scan] session present:', !!session, '| user:', session?.user?.id?.slice(0, 8));

  // Call the Supabase Edge Function
  const devMode = useSettingsStore.getState().devMode;

  // Raw fetch fallback so we can see the actual HTTP status + body
  // regardless of how the Supabase client wraps the error.
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  console.log('[haiku-scan] supabase url set:', supabaseUrl.length > 0, '| anon key set:', anonKey.length > 0);

  const rawRes = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? anonKey}`,
      'apikey': anonKey,
      ...(devMode ? { 'x-quenchr-dev-mode': 'true' } : {}),
    },
    body: JSON.stringify({ frames, platform, mode: 'full' }),
  });

  console.log('[haiku-scan] raw fetch status:', rawRes.status);
  const rawBody = await rawRes.json().catch(() => ({}));
  console.log('[haiku-scan] raw fetch body:', JSON.stringify(rawBody).slice(0, 200));

  if (!rawRes.ok) {
    const msg = rawBody?.error ?? rawBody?.message ?? `HTTP ${rawRes.status}`;
    if (rawRes.status === 401) throw new Error('Session expired. Please log out and log back in, then try again.');
    if (rawRes.status === 403) throw new Error(msg);
    if (rawRes.status >= 500) throw new Error('AI service temporarily unavailable. Please try again in a moment.');
    throw new Error(msg);
  }

  const data = rawBody;
  const error = null;

  if (error) {
    // Supabase wraps non-2xx responses as FunctionsHttpError.
    // Unwrap the body to get the real error; fall back to status-specific
    // human-readable messages so the alert is actually useful.
    let message = error.message;
    let status: number | undefined;
    try {
      const ctx = (error as any).context;
      status = ctx?.status;
      const body = await ctx?.json?.();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      // body parse failed — fall through to status-based message
    }

    // Map gateway-level errors to readable messages
    if (status === 401 || message.toLowerCase().includes('jwt') || message.toLowerCase().includes('invalid') ) {
      message = 'Session expired. Please log out and log back in, then try again.';
    } else if (status === 403 && !message.toLowerCase().includes('free tier')) {
      message = 'Access denied. Please check your subscription status.';
    } else if (status === 502 || status === 503 || status === 504) {
      message = 'AI service temporarily unavailable. Please try again in a moment.';
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
