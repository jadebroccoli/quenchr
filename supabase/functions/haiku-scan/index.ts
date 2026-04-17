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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-quenchr-dev-mode',
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
- 0-15: Completely clean. News, memes, food, pets, landscapes, text posts, fully-clothed people in neutral poses
- 16-35: Mildly suggestive. Tight gym clothing, minor skin showing, standard fitness content, beach group photos
- 36-65: Clearly suggestive. Thirst traps, provocative poses, suggestive captions, OF promos, lingerie, bikini close-ups, shirtless body-focused shots
- 66-100: Highly explicit. Near-nudity, extremely provocative content, sexual content, exposed intimate areas

Be STRICT. This app exists to flag content users are trying to escape. Default to scoring HIGHER when uncertain.

Concrete calibration anchors — if you see any of these, the score MUST meet or exceed the listed floor:
- Fully-clothed woman with visible cleavage or bodycon-emphasized figure posing toward camera: at least 40
- Bikini or swimwear shot where the body is the focus (not a group beach photo): at least 50
- Shirtless muscular man flexing or posing for the camera: at least 45
- Clearly suggestive pose (arched back, hands on body, looking-into-lens thirst trap energy): at least 55
- Lingerie, underwear, body-tight fitness wear with suggestive framing: at least 60
- OnlyFans / adult-platform promo: at least 70
- Explicit nudity, near-nudity, simulated sexual acts: at least 80

IMPORTANT CONSISTENCY RULE: the category field and suggestive_score MUST agree.
- score 0-15 → category "clean"
- score 16-35 → category "mild"
- score 36-65 → category "suggestive"
- score 66-100 → category "explicit"
NEVER output e.g. category="suggestive" with score=10. Pick the score first, then the matching category.

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
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('[haiku-scan] User lookup error:', userError);
        // Don't hard-block on DB lookup failure
      } else {
        const isPro = userData?.subscription_tier === 'pro' || userData?.subscription_tier === 'trial';

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
          'anthropic-version': '2023-06-01',
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

    // 5. If all batches failed, return an error instead of zeros
    if (allClassifications.length === 0) {
      return errorResponse(502, 'All classification batches failed. Check Anthropic API key and request format.');
    }

    // ── Normalize score/category consistency ──
    // Haiku frequently assigns category='suggestive' while giving
    // suggestive_score=~10, which contradicts the prompt's defined ranges
    // and drags the feed score unrealistically low. We trust the category
    // judgment and clamp the numeric score into the band that category
    // represents. The clamped score is what gets used for all downstream
    // math AND what we return to the client.
    const categoryBands: Record<string, [number, number]> = {
      clean: [0, 15],
      mild: [16, 35],
      suggestive: [36, 65],
      explicit: [66, 100],
    };
    for (const c of allClassifications) {
      const band = categoryBands[c.category];
      if (band) {
        const [floor, ceil] = band;
        const original = c.suggestive_score;
        const clamped = Math.max(floor, Math.min(ceil, original));
        if (clamped !== original) {
          (c as any)._raw_score = original;
          c.suggestive_score = clamped;
        }
      }
    }

    // Count categories
    const categoryCounts = {
      clean: allClassifications.filter(c => c.category === 'clean').length,
      mild: allClassifications.filter(c => c.category === 'mild').length,
      suggestive: allClassifications.filter(c => c.category === 'suggestive').length,
      explicit: allClassifications.filter(c => c.category === 'explicit').length,
    };

    // Calculate feed score using the shared formula (see computeFeedScore).
    // Tuned to alert users when even a few suggestive frames appear —
    // previous formula (30% prev + 70% intensity) was too flat because
    // intensity stays pinned to the category floor while prevalence is
    // naturally low (a 30-frame scan with 2 real hits = ~7% prev).
    const hardFlagged = allClassifications.filter(
      c => c.category === 'suggestive' || c.category === 'explicit'
    );
    const softFlagged = allClassifications.filter(c => c.category === 'mild');
    const total = allClassifications.length;
    const hardPrev = total > 0 ? (hardFlagged.length / total) * 100 : 0;
    const softPrev = total > 0 ? (softFlagged.length / total) * 100 : 0;
    const hardIntensity = hardFlagged.length > 0
      ? hardFlagged.reduce((sum, c) => sum + c.suggestive_score, 0) / hardFlagged.length
      : 0;
    // Presence bonus: if ANY hard flag exists, add 15 baseline points —
    // even a single thirst trap in a scroll session is worth flagging.
    const presenceBonus = hardFlagged.length > 0 ? 15 : 0;
    const totalScore = Math.min(100, Math.max(0, Math.round(
      hardPrev * 1.2
      + hardIntensity * 0.5
      + softPrev * 0.3
      + presenceBonus
    )));
    // Legacy variables kept for the existing console.log payload.
    const prevalence = hardPrev;
    const mildBump = softPrev * 0.3;

    // Per-frame diagnostic for ALL frames so we can see calibration issues
    // even when the trouble is in the tail of the sequence (frames 20+).
    // idx = original frame index from the video timeline
    // cat = Haiku's category judgment
    // score = clamped score actually used in the formula
    // raw = the unclamped model-reported score (undefined if it already
    //       sat inside its category band — i.e. no clamp was needed)
    // type = Haiku's content_type label (meme, fitness, thirst_trap, ...)
    const frameSample = allClassifications.map(c => ({
      idx: c.frame_index,
      cat: c.category,
      score: c.suggestive_score,
      raw: (c as any)._raw_score,
      type: c.content_type,
    }));

    console.log('[haiku-scan] score breakdown:', {
      total: allClassifications.length,
      clean: categoryCounts.clean,
      mild: softFlagged.length,
      hardFlagged: hardFlagged.length,
      prevalence: prevalence.toFixed(1),
      mildBump: mildBump.toFixed(1),
      hardIntensity: hardIntensity.toFixed(1),
      totalScore,
    });
    // Separate log so the summary above stays scannable and the big
    // array doesn't truncate it in the log viewer.
    console.log('[haiku-scan] frames:', JSON.stringify(frameSample));

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
