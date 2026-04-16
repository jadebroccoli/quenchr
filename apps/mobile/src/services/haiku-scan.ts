import { File as ExpoFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@quenchr/supabase-client';
import type { Platform } from '@quenchr/shared';
import { useSettingsStore } from '../stores/settings-store';
import { useAuthStore } from '../stores/auth-store';

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

  const devMode = useSettingsStore.getState().devMode;

  // ── Token acquisition with detailed diagnostics ──
  // Previous attempts using supabase.functions.invoke exhibited persistent
  // "Session expired" 401s across multiple builds. To rule out any
  // supabase-js header-manipulation bug we're dropping functions.invoke
  // in favor of raw fetch + loud diagnostic logs so we can actually see
  // where the failure is happening in device console.
  const storeToken = useAuthStore.getState().session?.access_token;
  let accessToken: string | undefined = storeToken;
  let tokenSource: 'store' | 'refresh' | 'getSession' | 'none' = storeToken ? 'store' : 'none';

  if (!accessToken) {
    console.log('[haiku-scan] no token in Zustand, trying refreshSession()...');
    try {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) console.warn('[haiku-scan] refreshSession error:', refreshErr.message);
      accessToken = refreshed?.session?.access_token ?? undefined;
      if (accessToken) tokenSource = 'refresh';
    } catch (e) {
      console.warn('[haiku-scan] refreshSession threw:', e);
    }
  }

  if (!accessToken) {
    console.log('[haiku-scan] refresh failed, trying getSession()...');
    try {
      const { data: s } = await supabase.auth.getSession();
      accessToken = s?.session?.access_token ?? undefined;
      if (accessToken) tokenSource = 'getSession';
    } catch (e) {
      console.warn('[haiku-scan] getSession threw:', e);
    }
  }

  console.log('[haiku-scan] token acquired:', {
    present: !!accessToken,
    source: tokenSource,
    prefix: accessToken ? accessToken.slice(0, 16) + '...' : null,
    length: accessToken?.length,
  });

  if (!accessToken) {
    throw new Error('Session expired [no-token]. Please log out and log back in, then try again.');
  }

  // ── Raw fetch to edge function ──
  // Bypasses supabase.functions.invoke / fetchWithAuth entirely.
  // We own the headers 100%.
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${FUNCTION_NAME}`;

  console.log('[haiku-scan] POSTing to', url, '| frames:', frames.length, '| devMode:', devMode);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'apikey': anonKey,
  };
  if (devMode) requestHeaders['x-quenchr-dev-mode'] = 'true';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ frames, platform, mode: 'full' }),
    });
  } catch (fetchErr: any) {
    console.error('[haiku-scan] fetch threw:', fetchErr?.message || fetchErr);
    throw new Error('Network error. Check your connection and try again.');
  }

  const status = response.status;
  const rawBody = await response.text();
  console.log('[haiku-scan] response:', status, '| body preview:', rawBody.slice(0, 200));

  let body: any = null;
  try { body = JSON.parse(rawBody); } catch { /* not json */ }

  if (!response.ok) {
    // Surface the actual server error for diagnostics instead of a generic fallback.
    const serverMsg: string = body?.error || body?.message || rawBody || `HTTP ${status}`;
    console.error('[haiku-scan] edge function error:', { status, serverMsg });

    if (status === 401) {
      // Tagged so we can tell it came from the server, not the client-side no-token branch.
      throw new Error(`Session expired [401 from edge: ${serverMsg.slice(0, 80)}]. Please log out and log back in, then try again.`);
    }
    if (status === 403 && !serverMsg.toLowerCase().includes('free tier')) {
      throw new Error('Access denied. Please check your subscription status.');
    }
    if (status >= 500) {
      throw new Error('AI service temporarily unavailable. Please try again in a moment.');
    }
    throw new Error(serverMsg);
  }

  if (!body?.success) {
    throw new Error(body?.error ?? 'Unknown Haiku scan error');
  }

  return body.data as HaikuScanResult;
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
