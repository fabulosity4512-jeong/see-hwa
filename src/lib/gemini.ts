import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically injected by the platform.
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateImageFromPoem(poem: string, style: string = "watercolor") {
  try {
    // Using gemini-2.5-flash-image which is the recommended model for general image generation
    const imageModel = "gemini-2.5-flash-image";
    const prompt = `Create a high-quality, artistic image based on this Korean poem. Style: ${style}. Mood: Emotional, oriental, elegant. IMPORTANT: Do NOT include any text, letters, or characters in the image itself. The image should be purely visual. Poem content: ${poem}`;
    
    const response = await genAI.models.generateContent({
      model: imageModel,
      contents: { 
        parts: [{ text: prompt }] 
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
        }
      }
    });

    // Find the image part in the response
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates found in response");
    }

    const parts = candidate.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts found in response content");
    }

    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("The model did not return an image. It might be due to safety filters or prompt complexity.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}
