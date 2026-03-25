// Supabase Edge Function: AI Feed Analysis
// Proxies Claude Haiku vision calls for Pro users.
// Keeps the Anthropic API key server-side only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ──

interface AnalysisFrame {
  frame_index: number;
  image_base64: string;
  suggestive_percentage: number;
}

interface AnalysisRequest {
  frames: AnalysisFrame[];
  platform: 'instagram' | 'tiktok';
  feed_score: number;
  audit_id?: string;
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

function buildSystemPrompt(platform: string, feedScore: number): string {
  return `You are an AI feed analyst for Quenchr, an app that helps users clean sexually suggestive content from their social media algorithms.

You will receive screenshots from a user's ${platform} feed that an on-device ML model (NSFWJS) has flagged as potentially suggestive. Your job is deeper contextual analysis.

IMPORTANT CONTEXT:
- The NSFWJS model uses grid-based classification and often produces false positives (e.g., a beach vacation photo, fitness content, a person in normal summer clothing)
- Your role is to provide CONTEXT that a simple classifier cannot: what type of content is this, what kind of account posted it, and whether the NSFWJS flag is a genuine concern or a false positive
- The user's current NSFWJS feed score is ${feedScore}/100 (0 = clean, 100 = fully suggestive)

CONTENT TYPES you should classify each frame as:
- thirst_trap: Intentionally sexually provocative content designed to attract attention
- fitness: Workout, gym, or athletic content that may show skin but is fitness-focused
- onlyfans_promo: Content promoting OnlyFans, Fansly, or similar adult subscription platforms
- dating_ad: Dating app advertisements or dating-related sponsored content
- swimwear_beach: Beach/pool/vacation content with swimwear in a natural context
- lingerie: Lingerie or underwear content (ads or personal posts)
- dance_trend: Dance challenge or trend content that may be suggestive in style
- provocative_selfie: Selfie intentionally emphasizing physical features
- suggestive_meme: Meme or text post with suggestive imagery
- other_suggestive: Other content that is genuinely suggestive but doesn't fit above categories

ACCOUNT TYPES:
- influencer: Social media influencer with large following
- brand: Commercial brand account
- personal_friend: Appears to be a regular person's personal account
- provocative_creator: Account primarily focused on provocative/sexual content
- dating_app: Dating app official account
- fitness_account: Fitness-focused account
- meme_page: Meme or humor account
- unknown: Cannot determine account type

FALSE POSITIVE CRITERIA:
Mark is_false_positive=true when the NSFWJS flag is likely incorrect because:
- The content is fitness/athletic in a gym or sports context
- Beach/pool photos in a natural vacation context
- Medical or educational content
- Fashion content that is not intentionally provocative
- Art or illustration that is not sexual

You MUST respond with ONLY a JSON object matching this exact structure (no markdown, no explanation outside the JSON):
{
  "frame_insights": [
    {
      "frame_index": <number matching the provided index>,
      "content_type": "<one of the content types above>",
      "is_false_positive": <boolean>,
      "false_positive_reason": "<string explaining why, or null if not a false positive>",
      "account_type": "<one of the account types above>",
      "description": "<one-line description of the content>"
    }
  ],
  "content_type_summary": { "<content_type>": <count>, ... },
  "account_type_summary": { "<account_type>": <count>, ... },
  "false_positive_count": <number>,
  "adjusted_feed_score": <number 0-100 after correcting for false positives, or null if no adjustment needed>,
  "recommendations": [
    {
      "title": "<short action title>",
      "description": "<why and how to do it>",
      "priority": <number 1-5, 1 being most important>
    }
  ],
  "summary": "<one paragraph summarizing the feed's content patterns and what the user should focus on>"
}`;
}

// ── Main Handler ──

serve(async (req: Request) => {
  // CORS preflight
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

    // 2. Verify Pro subscription (skip in dev mode)
    const devMode = req.headers.get('x-quenchr-dev-mode') === 'true';

    if (!devMode) {
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (userData?.subscription_tier !== 'pro') {
        return errorResponse(403, 'Pro subscription required for AI analysis');
      }
    }

    // 3. Parse request body
    const body: AnalysisRequest = await req.json();

    if (!body.frames || body.frames.length === 0) {
      return errorResponse(400, 'No frames provided');
    }
    if (body.frames.length > 10) {
      return errorResponse(400, 'Maximum 10 frames per analysis');
    }

    // 4. Build Claude Haiku vision request
    const imageContent = body.frames.flatMap((frame, i) => [
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
        text: `Frame ${i + 1} (index ${frame.frame_index}): NSFWJS flagged ${frame.suggestive_percentage}% of regions as suggestive`,
      },
    ]);

    const systemPrompt = buildSystemPrompt(body.platform, body.feed_score);
    const userPrompt = `Analyze the ${body.frames.length} flagged screenshot(s) above from this user's social media feed. For each frame, identify the content type, account type, and whether the NSFWJS flag is a false positive. Then provide an overall summary and personalized cleanup recommendations. Respond with ONLY the JSON object.`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2024-10-22',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              ...imageContent,
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('[ai-feed-analysis] Anthropic API error:', anthropicResponse.status, errText);
      return errorResponse(502, `AI analysis service error (${anthropicResponse.status}): ${errText.substring(0, 200)}`);
    }

    const anthropicData = await anthropicResponse.json();

    // 5. Extract JSON from response
    const rawText = anthropicData.content?.[0]?.text ?? '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('[ai-feed-analysis] Failed to parse AI response:', rawText.substring(0, 500));
      return errorResponse(502, 'Failed to parse AI analysis response');
    }

    let insights;
    try {
      insights = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[ai-feed-analysis] JSON parse error:', parseErr);
      return errorResponse(502, 'Invalid JSON in AI response');
    }

    // 6. Persist to Supabase
    try {
      await supabase.from('ai_insights').insert({
        user_id: user.id,
        audit_id: body.audit_id ?? null,
        platform: body.platform,
        insights_json: insights,
      });
    } catch (dbErr) {
      // Non-fatal — still return insights even if persistence fails
      console.error('[ai-feed-analysis] Failed to persist insights:', dbErr);
    }

    // 7. Return result
    return new Response(
      JSON.stringify({ success: true, data: insights }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      }
    );
  } catch (err) {
    console.error('[ai-feed-analysis] Unhandled error:', err);
    return errorResponse(500, 'Internal server error');
  }
});
