import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically injected by the platform.
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateImageFromPoem(poem: string, style: string = "watercolor") {
  try {
    // Generate the image using the poem and style directly with Gemini 1.5 Flash
    const imageModel = "gemini-1.5-flash";
    const prompt = `Create a high-quality, artistic image based on this Korean poem. 
    Style: ${style}. 
    Mood: Emotional, oriental, elegant. 
    IMPORTANT: Do NOT include any text, letters, or characters in the image itself. The image should be purely visual.
    Poem content: ${poem}`;
    
    const response = await genAI.models.generateContent({
      model: imageModel,
      contents: [{ parts: [{ text: prompt }] }],
    });

    // Find the image part in the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error("No parts found in response");
    }

    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}
