/**
 * Opt-in scan frame retention for AI training data.
 *
 * After each scan, if the user has consented in Settings > Data & AI Training,
 * this service silently uploads flagged frames (suggestive / explicit) to the
 * 'scan-frames' Supabase Storage bucket and records metadata in stored_frames.
 *
 * Frames are resized to 224×224 (EfficientNet input size) before upload.
 * Max 5 frames per scan. Entirely fire-and-forget — never blocks the UI.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@quenchr/supabase-client';
import { useAuthStore } from '../stores/auth-store';
import { useSettingsStore } from '../stores/settings-store';
import type { HaikuFrameClassification } from './haiku-scan';

// ── Constants ──────────────────────────────────────────────────────────────────

const BUCKET = 'scan-frames';
const FRAME_SIZE = 224;       // EfficientNet-B0 input — matches classifier/config.py IMAGE_SIZE
const FRAME_QUALITY = 0.85;   // JPEG quality: good fidelity without huge files (~30-80 KB)
const MAX_FRAMES_PER_SCAN = 5; // Keep storage costs low; 5 clear examples > 20 blurry ones

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Upload flagged frames to Supabase Storage (silently, non-blocking).
 *
 * Only runs when:
 *   1. User has opted in via Settings > frameRetentionConsent
 *   2. User is authenticated
 *   3. At least one suggestive/explicit frame exists
 *
 * Call with fire-and-forget: no await needed.
 */
export async function maybeRetainFrames(
  frameUris: string[],
  classifications: HaikuFrameClassification[],
  auditId: string | undefined,
  platform: string,
): Promise<void> {
  // Gate 1: consent check
  if (!useSettingsStore.getState().frameRetentionConsent) return;

  // Gate 2: auth check
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

  // Gate 3: find flagged frames — only training-valuable ones
  const flaggedSet = new Set(
    classifications
      .filter((c) => c.category === 'suggestive' || c.category === 'explicit')
      .map((c) => c.frame_index),
  );

  if (flaggedSet.size === 0) return;

  // Build upload list: map uri index → classification, cap at MAX_FRAMES_PER_SCAN
  const toUpload = frameUris
    .map((uri, i) => ({
      uri,
      index: i,
      classification: classifications.find((c) => c.frame_index === i),
    }))
    .filter((f) => flaggedSet.has(f.index))
    .slice(0, MAX_FRAMES_PER_SCAN);

  // Upload all concurrently — Promise.allSettled so one failure doesn't abort others
  await Promise.allSettled(
    toUpload.map(({ uri, index, classification }) =>
      uploadFrame({ uri, index, userId, auditId, platform, classification }),
    ),
  );
}

// ── Internal ──────────────────────────────────────────────────────────────────

interface UploadArgs {
  uri: string;
  index: number;
  userId: string;
  auditId: string | undefined;
  platform: string;
  classification: HaikuFrameClassification | undefined;
}

async function uploadFrame({
  uri,
  index,
  userId,
  auditId,
  platform,
  classification,
}: UploadArgs): Promise<void> {
  try {
    // Step 1: Resize to 224×224 square crop (center-crop via resize + crop)
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: FRAME_SIZE, height: FRAME_SIZE } },
      ],
      {
        format: ImageManipulator.SaveFormat.JPEG,
        compress: FRAME_QUALITY,
      },
    );

    // Step 2: Read as blob for Supabase storage upload
    const fetchResponse = await fetch(resized.uri);
    const blob = await fetchResponse.blob();

    // Step 3: Build storage path: {userId}/{auditId}/{index}_{timestamp}.jpg
    const scanFolder = auditId ?? 'unsaved';
    const fileName = `${index}_${Date.now()}.jpg`;
    const storagePath = `${userId}/${scanFolder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.warn('[frame-retention] storage upload error:', uploadError.message);
      return;
    }

    // Step 4: Record metadata in stored_frames table
    const { error: dbError } = await supabase.from('stored_frames').insert({
      user_id: userId,
      scan_id: auditId ?? null,
      storage_path: storagePath,
      platform,
      haiku_category: classification?.category ?? null,
      haiku_score: classification?.suggestive_score != null
        ? parseFloat(classification.suggestive_score.toFixed(2))
        : null,
    });

    if (dbError) {
      console.warn('[frame-retention] db insert error:', dbError.message);
      // Best-effort cleanup: remove the orphaned file
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    } else {
      console.log(`[frame-retention] retained frame ${index} (${classification?.category ?? 'unknown'}) → ${storagePath}`);
    }
  } catch (err) {
    // Never let a frame upload crash the calling context
    console.warn('[frame-retention] unexpected error for frame', index, err);
  }
}
