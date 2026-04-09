import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically injected by the platform.
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateImageFromPoem(poem: string, style: string = "watercolor") {
  try {
    // Generate the image using the poem and style directly with Imagen 3
    const imageModel = "imagen-3";
    const directPrompt = `Create a high-quality, artistic image based on this Korean poem. Style: ${style}. Mood: Emotional, oriental, elegant. IMPORTANT: Do NOT include any text, letters, or characters in the image itself. The image should be purely visual. Poem content: ${poem}`;
    
    const response = await genAI.models.generateImages({
      model: imageModel,
      prompt: directPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "9:16",
      }
    });

    // Extract the image from the response
    const generatedImage = response.generatedImages?.[0];
    if (!generatedImage || !generatedImage.image?.imageBytes) {
      throw new Error("No image generated from Imagen 3");
    }

    return `data:image/png;base64,${generatedImage.image.imageBytes}`;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}
