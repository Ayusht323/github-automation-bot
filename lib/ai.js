import logger from "@/lib/logger";

/**
 * Use Google Gemini to analyze issue/PR content.
 * Returns a summary and suggested labels.
 */
export async function analyzeWithAI(title, body, eventType) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn("GEMINI_API_KEY not configured, skipping AI analysis");
    return null;
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a GitHub project assistant. Analyze this ${eventType} and provide:
1. A concise 1-2 sentence summary
2. Suggested labels (choose from: bug, feature, enhancement, documentation, question, urgent, help-wanted, good-first-issue, security, performance)

Title: ${title || "No title"}
Body: ${body || "No body provided"}

Respond in this exact JSON format only, no markdown:
{"summary": "...", "labels": ["label1", "label2"]}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text.trim();
    // Parse JSON from response (handle potential markdown wrapping)
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(jsonStr);

    logger.info({ title, labels: result.labels }, "AI analysis completed");
    return {
      summary: result.summary || null,
      labels: Array.isArray(result.labels) ? result.labels : [],
    };
  } catch (error) {
    logger.error({ error: error.message, title }, "AI analysis failed");
    return null;
  }
}
