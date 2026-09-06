import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  childId?: string;
  intakeAnswers?: Record<string, any>;
  sessionDurationMinutes?: number;
  candidateActivities?: Array<{
    id: string;
    title: string;
    category?: string;
    targetCondition?: string;
    durationMinutes?: number;
  }>;
}

// JSON mode should return an object, but providers can still wrap it in a
// Markdown fence or a short preamble. Extract the first complete JSON object
// without altering content inside quoted strings.
function parseJsonObject(content: unknown): Record<string, unknown> | null {
  if (typeof content !== "string") return null;

  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, index + 1));
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sarvamApiKey = Deno.env.get("SARVAM_API_KEY");

    // Parse request body
    const body: RequestBody = await req.json();
    const { intakeAnswers, candidateActivities = [], sessionDurationMinutes } = body;

    if (!intakeAnswers || candidateActivities.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Missing intakeAnswers or candidateActivities",
          fallbackRequired: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if API key is present; if not, instruct client to use fallback engine
    if (!sarvamApiKey) {
      console.warn("SARVAM_API_KEY missing. Requesting rule-based fallback.");
      return new Response(
        JSON.stringify({
          success: false,
          suggestedBy: "rule_fallback",
          reason: "SARVAM_API_KEY not configured",
          recommendations: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize candidate list to minimize token usage
    const activityCatalog = candidateActivities.map((act) => ({
      id: act.id,
      title: act.title,
      category: act.category || "General",
      targetCondition: act.targetCondition || "",
      durationMinutes: act.durationMinutes ?? null,
    }));

    // System instruction forcing output schema & constrained IDs
    const systemPrompt = `You are a pediatric clinical AI specialized in ASD and Speech Therapy.
Select 3 to 5 most appropriate activities from the provided candidate catalog based on the child's 9-step intake data.

STRICT CONSTRAINTS:
1. ONLY select activity IDs that exist in the candidate catalog. DO NOT fabricate IDs.
2. Output strictly valid JSON matching this schema:
{
  "recommendations": [
    {
      "activityId": "STRING (must match an ID from catalog)",
      "priorityScore": NUMBER (1-10),
      "clinicalReasoning": "STRING"
    }
  ]
}
3. Do not repeat an activity. The combined durationMinutes of selected activities must not exceed the session duration when it is provided.`;

    const userPrompt = `
[9-STEP INTAKE DATA SUMMARY]
${JSON.stringify(intakeAnswers, null, 2)}

[SESSION DURATION IN MINUTES]
${sessionDurationMinutes ?? "Not provided"}

[CANDIDATE ACTIVITIES CATALOG]
${JSON.stringify(activityCatalog, null, 2)}
`;

    // Call Sarvam AI API
    // Sarvam's v1 chat endpoint supports sarvam-105b and authenticates with
    // api-subscription-key. Abort rather than holding a therapist's request
    // indefinitely; the client will use the existing rule-based fallback.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": sarvamApiKey,
        },
        body: JSON.stringify({
          model: "sarvam-105b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          // This is a constrained catalog-selection task, not a reasoning
          // task. Disable thinking so completion tokens are reserved for the
          // structured answer, then enforce its shape at the provider.
          reasoning_effort: null,
          max_tokens: 1_000,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "activity_recommendations",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["recommendations"],
                properties: {
                  recommendations: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["activityId", "priorityScore", "clinicalReasoning"],
                      properties: {
                        activityId: { type: "string" },
                        priorityScore: { type: "number", minimum: 1, maximum: 10 },
                        clinicalReasoning: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam AI API Error:", errText);
      return new Response(
        JSON.stringify({
          success: false,
          suggestedBy: "rule_fallback",
          reason: `Sarvam API HTTP error ${response.status}`,
          recommendations: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sarvamData = await response.json();
    const rawContent = sarvamData?.choices?.[0]?.message?.content || "";

    // Parse returned JSON from LLM
    const parsedJson = parseJsonObject(rawContent);
    if (!parsedJson) {
      console.error("Failed to parse Sarvam JSON output");
      return new Response(
        JSON.stringify({
          success: false,
          suggestedBy: "rule_fallback",
          reason: "Invalid JSON response from AI",
          recommendations: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate returned activity IDs against original candidate catalog
    const validCandidateIds = new Set(candidateActivities.map((a) => a.id));
    const seenActivityIds = new Set<string>();
    const validatedRecommendations = Array.isArray(parsedJson.recommendations)
      ? parsedJson.recommendations.filter((rec: unknown) => {
          if (!rec || typeof rec !== "object") return false;
          const activityId = (rec as { activityId?: unknown }).activityId;
          if (typeof activityId !== "string" || !validCandidateIds.has(activityId) || seenActivityIds.has(activityId)) {
            return false;
          }
          seenActivityIds.add(activityId);
          return true;
        })
      : [];

    // If validation yields no valid matches, fallback to rules
    if (validatedRecommendations.length === 0) {
      console.warn("AI returned zero valid activity IDs matching the catalog.");
      return new Response(
        JSON.stringify({
          success: false,
          suggestedBy: "rule_fallback",
          reason: "Zero matched catalog activity IDs",
          recommendations: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestedBy: "ai_engine",
        recommendations: validatedRecommendations,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unhandled Edge Function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        suggestedBy: "rule_fallback",
        reason: err?.message || "Internal server error",
        recommendations: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
