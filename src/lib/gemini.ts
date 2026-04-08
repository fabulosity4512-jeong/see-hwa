import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically injected by the platform.
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateImageFromPoem(poem: string, style: string = "watercolor") {
  try {
    const model = "gemini-2.5-flash-image";
    
    // First, we might want to enhance the prompt using a text model to get a better visual description
    // but for simplicity and directness, we'll combine the poem and style into a prompt.
    const prompt = `Create a high-quality, artistic image based on this Korean poem. 
    Style: ${style}. 
    Mood: Emotional, oriental, elegant. 
    IMPORTANT: Do NOT include any text, letters, or characters in the image itself. The image should be purely visual.
    Poem content: ${poem}`;

    const response = await genAI.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "9:16",
        }
      }
    });

    // Find the image part in the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
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
