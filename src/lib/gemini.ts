import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically injected by the platform.
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateImageFromPoem(poem: string, style: string = "watercolor") {
  try {
    // 1. Enhance the prompt using a text model to get a better visual description
    const textModel = "gemini-3-flash-preview";
    const enhancementPrompt = `당신은 시각 예술가입니다. 다음 시의 감성과 분위기를 분석하여, 이를 바탕으로 생성형 AI(Text-to-Image)를 위한 상세한 영어 묘사 프롬프트를 작성해 주세요.
    
    시 내용: ${poem}
    희망 스타일: ${style}
    
    프롬프트 규칙:
    1. 영어로 작성할 것.
    2. 시의 은유와 감성을 시각적인 요소(색감, 조명, 구도, 사물)로 변환할 것.
    3. "artistic, high-quality, masterpiece, emotional"와 같은 키워드를 포함할 것.
    4. 이미지 내에 텍스트나 글자가 절대 포함되지 않도록 "no text, no letters"를 명시할 것.
    5. 오직 프롬프트 내용만 출력할 것.`;

    const enhancedResponse = await genAI.models.generateContent({
      model: textModel,
      contents: enhancementPrompt
    });
    
    const visualPrompt = enhancedResponse.text || poem;

    // 2. Generate the image using the enhanced visual prompt
    const imageModel = "gemini-2.5-flash-image";
    
    const response = await genAI.models.generateContent({
      model: imageModel,
      contents: { 
        parts: [{ text: visualPrompt }] 
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
        }
      }
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
