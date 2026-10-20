
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/coach") {
      if (request.method !== "POST") {
        return json({ error: "Please use POST to ask the coach." }, 405);
      }

      return handleCoach(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function handleCoach(request, env) {
  try {
    if (!env.GEMINI_API_KEY) {
      return json({
        error: "GEMINI_API_KEY is missing from the Cloudflare Worker secrets."
      }, 503);
    }

    let input;

    try {
      input = await request.json();
    } catch {
      return json({ error: "Invalid request. Please try again." }, 400);
    }

    const question =
      typeof input.question === "string"
        ? input.question.trim()
        : "";

    if (!question) {
      return json({ error: "Please enter your question first." }, 400);
    }

    if (question.length > 2000) {
      return json({
        error: "Please keep your question under 2,000 characters."
      }, 400);
    }

    const day = Math.max(1, Math.min(90, Number(input.day) || 1));

    const completed = Array.isArray(input.completed)
      ? input.completed
          .filter(item => typeof item === "string")
          .slice(0, 10)
          .join(", ")
      : "None recorded";

    const prompt = `
You are Winter Arc AI, a friendly personal growth coach
for a teenager in Bangladesh.

Journey day: ${day}/90
Completed habits: ${completed}
User question: ${question}

Give practical, affordable advice in simple language.
Suggest small steps that are easy to begin today.

Never recommend starvation, extreme exercise, sleep
deprivation, steroids, or punishment. Encourage adequate
sleep, regular meals, and age-appropriate exercise.
Do not diagnose medical or mental-health conditions.
When appropriate, suggest speaking with a trusted adult
or qualified professional.
If the user misses a day, help them restart without shame.

Keep the answer concise and end with one clear action
the user can take today.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 700
          }
        })
      }
    );

    if (!response.ok) {
      return json({
        error:
          "Gemini rejected the request (HTTP " +
          response.status +
          "). Check API access, billing or quota."
      }, 502);
    }

    const result = await response.json();

    const answer = result?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return json({
        error: "Gemini returned no answer. Please try again."
      }, 502);
    }

    return json({ answer });
  } catch {
    return json({
      error: "The AI coach encountered an error. Please try again."
    }, 500);
  }
}
