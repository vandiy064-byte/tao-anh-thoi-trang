
import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  // Priority: 1. User-selected API Key (process.env.API_KEY)
  //           2. Default Platform API Key (process.env.GEMINI_API_KEY)
  return process.env.API_KEY || process.env.GEMINI_API_KEY || "";
};

const getMimeType = (base64: string) => {
  const match = base64.match(/^data:(image\/[a-zA-Z]+);base64,/);
  return match ? match[1] : 'image/jpeg';
};

/**
 * Resizes a base64 image to prevent "Payload Too Large" errors and improve performance.
 */
const resizeImage = (base64: string, maxDimension: number = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = base64;
  });
};

export const cleanImageBackground = async (imageBase64: string, type: 'CLOTHING' | 'PRODUCT'): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
  
  // Resize before sending to API
  const resizedBase64 = await resizeImage(imageBase64, 800);
  const imageData = resizedBase64.split(',')[1];
  const mimeType = getMimeType(resizedBase64);

  const prompt = type === 'CLOTHING' 
    ? "Isolate the clothing item. Remove the person, mannequin, and background. Output the clothing item alone on a pure white background."
    : "Isolate the product. Remove all background and shadows. Output the product alone on a pure white background.";

  try {
    const response = await ai.models.generateContent({
      // Try gemini-3.1-flash-image-preview as it might have better availability/permissions
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { inlineData: { data: imageData, mimeType } },
          { text: prompt }
        ]
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    if (response.candidates?.[0].finishReason === 'SAFETY') {
      throw new Error("SAFETY_FILTER");
    }

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    console.error("Lỗi xử lý ảnh:", error);
    if (error.message?.includes("429")) throw new Error("QUOTA_EXHAUSTED");
    if (error.message === "SAFETY_FILTER") throw error;
    throw error;
  }
};

export const generateFullComposition = async (
  modelImg: string,
  clothingImg: string | null,
  productImg: string | null,
  environmentImg: string | null,
  settings: {
    aspectRatio: string;
    pose: string;
    environment: string;
    environmentDetail: string;
    clothingStyle: string;
    clothingType: string;
    clothingDetail: string;
    shotType: string;
  },
  variationId: number
): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
  
  // Resize all inputs to ensure we don't hit payload limits
  const resizedModel = await resizeImage(modelImg, 1024);
  const parts: any[] = [
    { inlineData: { data: resizedModel.split(',')[1], mimeType: getMimeType(resizedModel) } } 
  ];

  if (clothingImg) {
    const resizedClothing = await resizeImage(clothingImg, 800);
    parts.push({ inlineData: { data: resizedClothing.split(',')[1], mimeType: getMimeType(resizedClothing) } });
  }

  if (productImg) {
    const resizedProduct = await resizeImage(productImg, 800);
    parts.push({ inlineData: { data: resizedProduct.split(',')[1], mimeType: getMimeType(resizedProduct) } });
  }

  if (environmentImg) {
    const resizedEnv = await resizeImage(environmentImg, 1024);
    parts.push({ inlineData: { data: resizedEnv.split(',')[1], mimeType: getMimeType(resizedEnv) } });
  }

  const lightingStyles = [
    "High-end fashion studio lighting with soft shadows and a clean aesthetic.",
    "Natural golden hour sunlight with warm, cinematic glows and long shadows.",
    "Modern urban street lighting with sharp contrasts and subtle neon reflections.",
    "Soft, diffused daylight for a clean, commercial look with high dynamic range."
  ];

  const prompt = `
    TASK: Fashion AI Studio - Create a high-end commercial photo.
    
    INPUTS:
    1. Human Model: Use this person's face and body structure.
    ${clothingImg ? '2. Clothing: Dress the model in this EXACT clothing item.' : ''}
    ${productImg ? '3. Product: Place this product naturally in the scene.' : ''}
    ${environmentImg ? '4. Environment: Use this background.' : `4. Environment: Create a ${settings.environment} background. ${settings.environmentDetail}`}

    DETAILS:
    - Shot: ${settings.shotType}
    - Pose: ${settings.pose}
    - Style: ${settings.clothingStyle}
    - Lighting: ${lightingStyles[variationId]}
    - Note: ${settings.clothingDetail}

    REQUIREMENTS:
    - Photorealistic, high-fashion quality.
    - Seamless integration of model, clothing, and background.
    - Maintain model's identity and clothing details perfectly.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      // Using gemini-3.1-flash-image-preview for better compatibility
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: { 
        imageConfig: { 
          aspectRatio: settings.aspectRatio as any,
          imageSize: "1K"
        } 
      }
    });

    if (response.candidates?.[0].finishReason === 'SAFETY') {
      throw new Error("SAFETY_FILTER");
    }

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    if (error.message?.includes("429")) throw new Error("QUOTA_EXHAUSTED");
    if (error.message?.includes("403") || error.message?.includes("401")) throw new Error("AUTH_ERROR");
    if (error.message === "SAFETY_FILTER") throw error;
    throw error;
  }
};

export const replaceBackground = async (
  sourceImg: string,
  environmentImg: string | null,
  settings: {
    aspectRatio: string;
    environment: string;
    environmentDetail: string;
  }
): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
  
  const resizedSource = await resizeImage(sourceImg, 1024);
  const parts: any[] = [
    { inlineData: { data: resizedSource.split(',')[1], mimeType: getMimeType(resizedSource) } } 
  ];

  if (environmentImg) {
    const resizedEnv = await resizeImage(environmentImg, 1024);
    parts.push({ inlineData: { data: resizedEnv.split(',')[1], mimeType: getMimeType(resizedEnv) } });
  }

  const prompt = `
    TASK: Background Replacement - Replace the background of the provided image.
    
    INPUTS:
    1. Source Image: Keep the main subject (person/product) EXACTLY as they are.
    ${environmentImg ? '2. New Background: Use this background image.' : `2. New Background: Create a ${settings.environment} background. ${settings.environmentDetail}`}

    REQUIREMENTS:
    - Seamlessly integrate the subject into the new background.
    - Maintain the subject's lighting, shadows, and identity perfectly.
    - Photorealistic, high-end studio quality.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: { 
        imageConfig: { 
          aspectRatio: settings.aspectRatio as any,
          imageSize: "1K"
        } 
      }
    });

    if (response.candidates?.[0].finishReason === 'SAFETY') {
      throw new Error("SAFETY_FILTER");
    }

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    console.error("Background Replacement Error:", error);
    if (error.message?.includes("429")) throw new Error("QUOTA_EXHAUSTED");
    if (error.message?.includes("403") || error.message?.includes("401")) throw new Error("AUTH_ERROR");
    if (error.message === "SAFETY_FILTER") throw error;
    throw error;
  }
};
