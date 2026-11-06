import { GoogleGenAI } from "@google/genai";

export async function POST(request) {
  const apiKey = (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your_"))
    ? process.env.GEMINI_API_KEY
    : (process.env.GOOGLE_API_KEY && !process.env.GOOGLE_API_KEY.includes("your_"))
      ? process.env.GOOGLE_API_KEY
      : "";
  
  if (!apiKey) {
    return Response.json(
      { error: "Gemini API key is not configured. Please set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local" },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
    }

    const imageModels = [
      "gemini-2.5-flash-image",
      "gemini-3-pro-image",
      "gemini-3.1-flash-image-preview",
    ];

    let lastError = null;

    for (const model of imageModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        if (response.parts) {
          for (const part of response.parts) {
            if (part.inlineData) {
              const base64 = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || "image/png";
              const url = `data:${mimeType};base64,${base64}`;
              return Response.json({ url });
            }
          }
        }
      } catch (err) {
        lastError = err;
        console.warn(`Image model ${model} failed, trying next:`, err?.message || err);
      }
    }

    return Response.json(
      { error: lastError?.message || "No image returned from model" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Gemini image error:", error?.message || error);
    return Response.json({ error: error?.message || "Failed to generate image" }, { status: 500 });
  }
}
