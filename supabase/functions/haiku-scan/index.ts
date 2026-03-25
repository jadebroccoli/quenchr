// Supabase Edge Function: Haiku Vision Scan
// Uses Claude Haiku 4.5 to classify feed frames as suggestive or clean.
// Returns per-frame scores that replace or supplement NSFWJS results.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ──

interface ScanFrame {
  frame_index: number;
  image_base64: string;
}

interface ScanRequest {
  frames: ScanFrame[];
  platform: 'instagram' | 'tiktok';
  mode: 'full' | 'rescore'; // full = classify all, rescore = only re-check flagged
}

interface FrameClassification {
  frame_index: number;
  suggestive_score: number; // 0-100, how suggestive this frame is
  category: 'clean' | 'mild' | 'suggestive' | 'explicit';
  content_type: string; // e.g., "thirst_trap", "fitness", "swimwear", "normal"
  description: string; // one-line description
}

// ── Environment ──

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Helpers ──

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    }
  );
}

// Process frames in batches to stay within token limits
// Haiku 4.5 handles ~5 images well per request
const BATCH_SIZE = 5;

function buildClassificationPrompt(platform: string): string {
  return `You are a content classifier for a feed hygiene app. Analyze each screenshot from a user's ${platform} feed and rate how sexually suggestive it is.

For EACH frame, respond with:
- suggestive_score: 0-100 (0 = completely clean, 100 = extremely explicit)
- category: "clean" (0-15), "mild" (16-35), "suggestive" (36-65), or "explicit" (66-100)
- content_type: classify as one of: normal, fitness, swimwear_beach, fashion, thirst_trap, provocative_selfie, dance_trend, lingerie, onlyfans_promo, suggestive_meme, explicit_content
- description: one short sentence describing what's in the frame

SCORING GUIDE:
- 0-15: No suggestive elements. News, memes, food, pets, landscapes, text posts, normal clothed people
- 16-35: Mildly suggestive. Tight clothing, minor skin showing, fitness content, beach photos in context
- 36-65: Clearly suggestive. Thirst traps, provocative poses, suggestive captions, OF promos, lingerie
- 66-100: Highly explicit. Near-nudity, extremely provocative content, sexual content

Be STRICT — the whole point of this app is to flag content users wouldn't want their mom seeing. When in doubt, score higher.

Respond with ONLY a JSON array of objects. No markdown, no explanation:
[{"frame_index": 0, "suggestive_score": 25, "category": "mild", "content_type": "fitness", "description": "Woman doing squats at gym"}, ...]`;
}

// ── Main Handler ──

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(401, 'Invalid or expired token');
    }

    // 2. Check scan quota (skip in dev mode)
    const devMode = req.headers.get('x-quenchr-dev-mode') === 'true';

    if (!devMode) {
      // Check if user is Pro or has free scans remaining
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      const isPro = userData?.subscription_tier === 'pro';

      if (!isPro) {
        // Check weekly Haiku scan count
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('feed_audits')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('scan_type', 'haiku')
          .gte('created_at', oneWeekAgo);

        if ((count ?? 0) >= 1) {
          return errorResponse(403, 'Free tier: 1 AI-powered scan per week. Upgrade to Pro for unlimited scans.');
        }
      }
    }

    // 3. Parse request
    const body: ScanRequest = await req.json();

    if (!body.frames || body.frames.length === 0) {
      return errorResponse(400, 'No frames provided');
    }
    if (body.frames.length > 30) {
      return errorResponse(400, 'Maximum 30 frames per scan');
    }

    // 4. Process frames in batches
    const allClassifications: FrameClassification[] = [];
    const systemPrompt = buildClassificationPrompt(body.platform);

    for (let i = 0; i < body.frames.length; i += BATCH_SIZE) {
      const batch = body.frames.slice(i, i + BATCH_SIZE);

      const imageContent = batch.flatMap((frame, batchIdx) => [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/jpeg' as const,
            data: frame.image_base64,
          },
        },
        {
          type: 'text' as const,
          text: `Frame ${frame.frame_index}`,
        },
      ]);

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2024-10-22',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                ...imageContent,
                { type: 'text', text: `Classify these ${batch.length} frames. Return JSON array only.` },
              ],
            },
          ],
        }),
      });

      if (!anthropicResponse.ok) {
        const errText = await anthropicResponse.text();
        console.error(`[haiku-scan] Batch ${i / BATCH_SIZE + 1} error:`, anthropicResponse.status, errText);
        // Continue with other batches rather than failing entirely
        continue;
      }

      const anthropicData = await anthropicResponse.json();
      const rawText = anthropicData.content?.[0]?.text ?? '';

      // Parse JSON array from response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const batchResults: FrameClassification[] = JSON.parse(jsonMatch[0]);
          allClassifications.push(...batchResults);
        } catch (parseErr) {
          console.error(`[haiku-scan] Parse error in batch ${i / BATCH_SIZE + 1}:`, parseErr);
        }
      }
    }

    // 5. Calculate overall score
    const totalScore = allClassifications.length > 0
      ? Math.round(allClassifications.reduce((sum, c) => sum + c.suggestive_score, 0) / allClassifications.length)
      : 0;

    // Count categories
    const categoryCounts = {
      clean: allClassifications.filter(c => c.category === 'clean').length,
      mild: allClassifications.filter(c => c.category === 'mild').length,
      suggestive: allClassifications.filter(c => c.category === 'suggestive').length,
      explicit: allClassifications.filter(c => c.category === 'explicit').length,
    };

    const suggestivePercent = allClassifications.length > 0
      ? Math.round(((categoryCounts.suggestive + categoryCounts.explicit) / allClassifications.length) * 100)
      : 0;

    // 6. Return results
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          classifications: allClassifications,
          overall_score: totalScore,
          suggestive_percent: suggestivePercent,
          category_counts: categoryCounts,
          total_frames: allClassifications.length,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      }
    );
  } catch (err) {
    console.error('[haiku-scan] Unhandled error:', err);
    return errorResponse(500, 'Internal server error');
  }
});
