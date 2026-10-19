
export async function onRequestPost(context) {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });

  try {
    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) {
      return json({ error: "AI setup is incomplete. Please configure the Cloudflare secret." }, 503);
    }

    const request = await context.request.json();
    const question = typeof request.question === "string"
      ? request.question.trim()
      : "";

    const day = Math.max(1, Math.min(90, Number(request.day) || 1));

    const completed = Array.isArray(request.completed)
      ? request.completed
          .filter(item => typeof item === "string")
          .slice(0, 10)
      : [];

    if (!question) {
      return json({ error: "Please enter a question first." }, 400);
    }

    if (question.length > 2000) {
      return json({ error: "Please keep your question under 2,000 characters." }, 400);
    }

    const prompt = `
You are Winter Arc AI, a friendly personal growth coach for a teenager in Bangladesh.

Help the user build sustainable habits over a 90-day journey.
Give practical, clear, encouraging advice using small steps and affordable ideas.

Current journey day: ${day}/90.
Completed habits today: ${completed.join(", ") || "None recorded"}.
User question: ${question}

Safety rules:
- Never recommend starvation, extreme exercise, sleep deprivation, steroids, or punishment.
- Encourage regular meals, adequate sleep, and age-appropriate activity.
- Do not diagnose medical or mental-health conditions.
- Encourage talking with a trusted adult or qualified professional when appropriate.
- Be kind if the user misses a day; help them restart without shame.

Give a useful answer and one clear action the user can take today.
Use simple language and keep the answer concise.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
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
        error: "Gemini could not answer. Check your API key and Gemini API access."
      }, 502);
    }

    const result = await response.json();

    const answer = result?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return json({ error: "No answer was returned. Please try again." }, 502);
    }

    return json({ answer });
  } catch {
    return json({
      error: "Something went wrong. Please try again."
    }, 500);
  }
}
