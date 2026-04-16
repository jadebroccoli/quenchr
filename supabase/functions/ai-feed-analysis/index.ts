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

function buildSystemPrompt(platform: string, feedScore: number): string {
  return `You are Quenchr's feed analyst. Quenchr helps people take control of sexually suggestive content in their social media algorithms.

You will receive screenshots from a user's ${platform} feed that Quenchr's initial pass flagged as potentially suggestive. Your job is deeper, human-level analysis: what the content actually IS, who's posting it, and whether the flag was a real concern or a false alarm.

CONTEXT:
- The initial scan catches obvious stuff but sometimes flags innocent content (beach vacation, gym content, normal summer clothing).
- The user's current provisional feed score is ${feedScore}/100 (0 = totally clean, 100 = heavily suggestive). You may adjust it via "adjusted_feed_score" based on what you actually see.

CONTENT TYPES — classify each frame as one of:
- thirst_trap: Intentionally provocative content designed to attract attention through sexuality
- fitness: Workout or athletic content that shows skin but is genuinely fitness-focused
- onlyfans_promo: Content promoting OnlyFans, Fansly, or similar adult platforms
- dating_ad: Dating app ads or dating-related sponsored content
- swimwear_beach: Beach/pool/vacation content with swimwear in a natural setting
- lingerie: Lingerie or underwear content (ads or personal posts)
- dance_trend: Dance challenge or trend that's suggestive in style
- provocative_selfie: Selfie deliberately emphasizing physical features
- suggestive_meme: Meme or text post with suggestive imagery
- other_suggestive: Genuinely suggestive content that doesn't fit above categories

ACCOUNT TYPES:
- influencer | brand | personal_friend | provocative_creator | dating_app | fitness_account | meme_page | unknown

FALSE ALARM CRITERIA — mark is_false_positive=true when the flag is likely wrong:
- Fitness/athletic content in a gym or sports context
- Beach/pool photos in a natural vacation context
- Medical or educational content
- Fashion content that isn't intentionally provocative
- Art or illustration that isn't sexual

VOICE & TONE for "summary" and "recommendations":
- You are the user's sharp, slightly amused friend who's seen their feed and has opinions.
- Dry humor. Light teasing. Poke gentle fun at the pattern you see — never at the person.
- Examples of the register we want:
    "Your algorithm has decided you're one workout influencer away from buying a weight vest."
    "Half of what got flagged is just a Lululemon ad trying too hard. Calm down, spreadsheet."
    "Whoever hello_benty26 is, she has cracked the Explore page. Unfollow and take your dignity with you."
- Be specific. Call out concrete patterns and accounts you actually see.
- Warm-ish roast, not mean. Never cruel, never moralizing, never clinical.

HARD RULES — do not violate:
- NEVER mention the words "Haiku", "Claude", "Anthropic", "GPT", "model", "AI model", "vision model", "classifier", "neural network", or any other system/technology name. The user should feel like Quenchr analyzed their feed — full stop.
- NEVER reference the numeric score in the "summary" paragraph. The UI already displays the score prominently, and repeating it just sounds robotic. Talk about the feed itself.
- NEVER describe how the scanning works, what frames were extracted, or the internal pipeline.
- NEVER use phrases like "our analysis", "the scan detected", "our system" — just speak about the feed directly.

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
  "adjusted_feed_score": <number 0-100 after correcting for false alarms, or null if no adjustment needed>,
  "recommendations": [
    {
      "title": "<short action title>",
      "description": "<why and how to do it — dry-humor register, no tech jargon, no score numbers>",
      "priority": <number 1-5, 1 being most important>
    }
  ],
  "summary": "<one paragraph — dry, warm roast about the feed's patterns. No numeric score. No tech/model names.>"
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

    // 2. Parse request body (before subscription check so we can read dev_mode flag)
    const body: AnalysisRequest = await req.json();

    // 3. Verify Pro subscription (skip in dev mode — check header and body)
    const devMode =
      req.headers.get('x-quenchr-dev-mode') === 'true' ||
      (body as any).dev_mode === true;

    if (!devMode) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('[ai-feed-analysis] User lookup error:', userError);
        // Don't hard-block if DB lookup fails — log and continue
      } else if (userData?.subscription_tier !== 'pro' && userData?.subscription_tier !== 'trial') {
        return errorResponse(403, 'Pro subscription required for AI analysis');
      }
    }

    if (!body.frames || body.frames.length === 0) {
      return errorResponse(400, 'No frames provided');
    }
    if (body.frames.length > 5) {
      return errorResponse(400, 'Maximum 5 frames per analysis');
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
        text: `Frame ${i + 1} (index ${frame.frame_index}): Quenchr AI flagged this frame with a suggestive score of ${frame.suggestive_percentage}%`,
      },
    ]);

    const systemPrompt = buildSystemPrompt(body.platform, body.feed_score);
    const userPrompt = `Analyze the ${body.frames.length} flagged screenshot(s) above from this user's social media feed. For each frame, identify the content type, account type, and whether the initial flag is a false alarm. Then provide an overall summary and personalized cleanup recommendations. Respond with ONLY the JSON object.`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
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
