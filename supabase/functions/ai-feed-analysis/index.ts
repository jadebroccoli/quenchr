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
- thirst_trap: Content whose sole purpose is sexual attention — poses, close-ups, body-focused framing
- fitness: Workout or athletic content that shows skin incidentally but is exercise-focused
- onlyfans_promo: Content explicitly promoting OnlyFans, Fansly, or similar adult platforms
- dating_ad: Dating app ads or dating-related sponsored content
- swimwear_beach: Beach/pool/vacation content with swimwear in a natural outdoor setting
- lingerie: Lingerie or underwear as the primary subject of the post
- dance_trend: Dance content where the movement style (grinding, twerking close-up) is the sexual element
- provocative_selfie: Selfie whose explicit purpose is to emphasize the body sexually
- suggestive_meme: Meme where the SEXUAL IMAGE OR JOKE is the main point — NOT a political/comedy meme that incidentally features someone in revealing clothing
- other_suggestive: Genuinely sexual content that doesn't fit above categories

For frames that are NOT sexual at all: still pick the closest content type above and set is_false_positive=true. Do NOT invent new content type values.

ACCOUNT TYPES:
- influencer | brand | personal_friend | provocative_creator | dating_app | fitness_account | meme_page | unknown

THE ONLY QUESTION THAT MATTERS:
"Would a stranger who glanced at this person's screen at work or on the train be uncomfortable because of SEXUAL content?"
- If yes → genuine flag (is_false_positive: false)
- If no → false positive (is_false_positive: true), no exceptions

FALSE POSITIVES — mark is_false_positive=true for ALL of the following, no exceptions:
- Fitness, gym, workout, athletic, sport, exercise content — ALWAYS false positive
- Pickleball, tennis, swimming, running, cycling, yoga, weightlifting — ALWAYS false positive
- Beach, pool, vacation, travel, tourism content — ALWAYS false positive
- Concert, live music, festival, performance footage — ALWAYS false positive
- Dance reels where the choreography or trend is the point (not a close-up body grind)
- Person talking to camera, vlogging, commentary, storytime — ALWAYS false positive
- Fashion, outfit, styling, makeup, hair tutorials — ALWAYS false positive
- Food, cooking, restaurants — ALWAYS false positive
- Nature, landscapes, architecture, cityscapes — ALWAYS false positive
- News, sports journalism, political content of any kind — ALWAYS false positive
- Memes of any kind where skin/clothing is incidental to the joke or message — ALWAYS false positive
- Any content where the flag is due to ambient skin, shoulders, athletic wear, or active clothing — ALWAYS false positive
- Any content where the reason it feels "suggestive" is non-sexual (politics, identity, aesthetics) — ALWAYS false positive

GENUINE FLAGS — is_false_positive: false ONLY for:
- Content whose deliberate, primary purpose is sexual attention: thirst traps, body-focused poses held for the camera
- OnlyFans / Fansly / adult platform promotions (explicit or implied)
- Lingerie or underwear as the main subject of the post
- Close-up body scans or slow-motion body-part footage clearly designed to be sexual
- Provocative selfies where the explicit point is to sexualise the body
- Dance content where the camera focus is on body parts grinding/twerking, not the choreography

If you are unsure whether something is a genuine flag or a false positive → it is a false positive.

MANDATORY CONSISTENCY RULE:
Your is_false_positive fields and your summary paragraph MUST agree completely.
- If your summary says the feed is clean, has no real concerns, or describes only non-sexual content → every single frame MUST have is_false_positive: true. Zero exceptions.
- If even one frame has is_false_positive: false, your summary must explicitly describe that frame as a sexual concern.
- NEVER write a clean/reassuring summary while leaving any frame with is_false_positive: false. That contradiction directly breaks the score display for the user.

POLITICAL/IDENTITY/CULTURAL CONTENT — ALWAYS a false positive, no exceptions:
If you find yourself thinking about drag, identity politics, religion, political parties, social movements, controversy, or culture war framing when deciding whether content is suggestive — STOP. That content is a false positive. Mark it and say nothing about the politics.

PLATFORM CONTEXT — CRITICAL for recommendations:
- This content is from the user's ${platform === 'tiktok' ? 'TikTok For You Page (FYP)' : 'Instagram Explore page'}.
- ${platform === 'tiktok'
  ? 'TikTok FYP content comes from accounts the user does NOT follow — algorithm-served. Recommend: long-press → "Not Interested" or "Don\'t Recommend this Creator". Only suggest unfollowing a clearly followed account.'
  : 'Instagram Explore content comes from accounts the user does NOT follow — algorithm-served. Recommend: tap three-dot menu → "Not Interested" or "Hide posts from [account]". Only suggest unfollowing a clearly followed account.'}
- Muting keywords works on both platforms.

SCOPE — ABSOLUTE:
Quenchr is a sexual content filter. Nothing else.
- If content is flagged for any reason other than being sexually suggestive → false positive. Mark it. Move on.
- NEVER mention political, identity, cultural, or social accounts in any output.
- NEVER use: drag, identity, leftist, conservative, politics, political, culture, controversial, religious, ideology.

RECOMMENDATIONS RULES — read carefully:
- If ALL frames in the batch are false positives → return "recommendations": [] (empty array). Zero recommendations. Do not suggest anything. The feed has no sexual content problem to solve.
- If there IS genuine sexual content → recommendations MUST be specifically about reducing THAT sexual content (hide the specific OF account, mute thirst-trap keywords, etc.).
- NEVER recommend muting non-sexual topics (cars, news, memes, sports, travel, food). That is not Quenchr's job.
- NEVER recommend unfollowing or hiding accounts for non-sexual reasons.
- If you find yourself writing a recommendation about car content, news, gaming, sports, or anything non-sexual → DELETE IT. It does not belong here.

VOICE & TONE for "summary" and "recommendations":
- Sharp, slightly amused friend giving a quick read of the feed. Dry humor, light teasing. Never at the person.
- The summary should read like: "here's what's actually in your feed, here's the one thing worth doing about it." Natural, direct, no technical framing.
- Examples of the right register:
    "Your algorithm has decided you're one workout influencer away from buying a weight vest."
    "Half of this is Lululemon ads trying too hard. The one account worth hiding is hello_benty26 — she's cracked Explore and the content is deliberate."
    "Mostly car content and memes in here. The real flag is one parking-lot reel from seancgould that's designed for shock value — hide that account and this cleans up."
- For clean feeds with no genuine content: one dry, reassuring sentence about what's actually there. E.g.: "Some memes, a mayoral event, ambient shoulders — nothing here is actually a concern."
- Be specific about accounts and patterns ONLY when there is genuine sexual content to call out.
- Warm, not mean. Never moralizing, never clinical.

SUMMARY HARD RULES — what the summary must NEVER say:
- NEVER reference the scan, the initial pass, flags, or any detection process. You are not reporting on a scan — you are describing a feed.
- NEVER say "the scanner", "initial scan", "flagged", "false positive", "corrected", "adjusted score", or any phrase that exposes the scoring mechanics.
- NEVER say things like "X got flagged but it's actually clean" — instead just describe what IS there: "Most of this is car content and memes."
- NEVER mention a numeric score.
- Just describe the feed like a friend who looked through it. What did you see? What's the actual concern, if any?

HARD RULES — do not violate:
- NEVER mention: "Haiku", "Claude", "Anthropic", "GPT", "model", "AI model", "classifier", or any system/technology name.
- NEVER reference the numeric score in the "summary" paragraph.
- NEVER describe how the scanning works or reference frames, pipeline, or internal process.
- NEVER use "our analysis", "the scan detected", "our system".
- NEVER mention political, identity, cultural, or social content in recommendations — not even to say "hide it". If it's not sexual, it's out of scope and you say nothing about it.
- NEVER name a specific account in recommendations unless the reason is purely SEXUAL (thirst trap, OF promo, etc.). Naming a meme account, political account, or cultural account is out of scope.

ADJUSTED SCORE CALCULATION — this is CRITICAL:
You MUST always return an adjusted_feed_score. Never return null.

The adjusted score should reflect ONLY genuinely suggestive content, not false positives.
Use this formula:
  genuine_count = (total frames analyzed) - false_positive_count
  genuine_ratio = genuine_count / (total frames analyzed)
  adjusted_feed_score = round(${feedScore} × genuine_ratio)

Examples:
  - Raw score 61, 4 frames, 3 false positives (1 genuine) → 61 × (1/4) = 15
  - Raw score 61, 4 frames, 4 false positives (0 genuine) → max(3, 61 × 0) = 3
  - Raw score 61, 4 frames, 0 false positives (all genuine) → 61 × (4/4) = 61
  - Raw score 40, 5 frames, 2 false positives (3 genuine) → 40 × (3/5) = 24

If the entire batch is false positives: return a score of 3–8 (never 0 — the algorithm is still serving this type of content, just not as bad as measured).
If there is any genuine suggestive content: scale proportionally. A single real thirst trap in an otherwise clean batch should land in the 10–20 range.
NEVER return the raw feed_score unchanged if you identified any false positives.

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
  "adjusted_feed_score": <number 0-100, ALWAYS calculated per the formula above — never null>,
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

    // 5b. Authoritative false-positive count derived from per-frame data.
    // The AI's top-level false_positive_count field is notoriously unreliable
    // (it often returns 0 while simultaneously marking individual frames as
    // is_false_positive:true). We always recompute from frame_insights and
    // override both false_positive_count and adjusted_feed_score.
    const totalFrames = body.frames.length;

    const computedFpCount: number = Array.isArray(insights.frame_insights)
      ? insights.frame_insights.filter((f: any) => f?.is_false_positive === true).length
      : (insights.false_positive_count ?? 0);

    // Sync the summary field so the client sees consistent data
    insights.false_positive_count = computedFpCount;

    const genuineCount = Math.max(0, totalFrames - computedFpCount);
    const genuineRatio = totalFrames > 0 ? genuineCount / totalFrames : 1;

    // Always recompute — never trust the AI's arithmetic on this field
    if (genuineCount === 0) {
      // All frames were false positives: tiny residual score (algo still served it)
      insights.adjusted_feed_score = Math.min(8, Math.round(body.feed_score * 0.05));
    } else {
      const computed = Math.round(body.feed_score * genuineRatio);
      // Accept AI's score only if it's directionally consistent (within 10pts of ours)
      const aiScore: number | null = insights.adjusted_feed_score ?? null;
      if (aiScore == null || Math.abs(aiScore - computed) > 10) {
        insights.adjusted_feed_score = computed;
      }
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
