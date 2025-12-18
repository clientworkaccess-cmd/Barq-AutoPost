import { GoogleGenAI } from "@google/genai";

/**
 * Helper to convert Base64 Data URL to Blob
 */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

/**
 * Access the API key from Vite environment variables.
 */
const API_KEY = (import.meta as any).env.VITE_API_KEY;

/**
 * Enhances the user's text using Gemini 3 Flash.
 */
export async function enhanceText(text: string, context: 'image' | 'text' = 'image'): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const instruction = context === 'image' 
      ? "Rewrite this professional accomplishment into a high-impact corporate headline for an image. Keep it under 15 words. Output ONLY the text."
      : "Rewrite this professional update into an engaging, polished LinkedIn post. Use a professional yet authentic tone. Keep it concise but impactful. Output ONLY the text.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${instruction}\n\nInput: "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    console.error("Text enhancement failed:", error);
    throw error;
  }
}

/**
 * Generates a sophisticated LinkedIn caption.
 */
export async function generateCaption(accomplishment: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Draft a high-end LinkedIn post caption based on this accomplishment.
      
      Achievement: "${accomplishment}"
      
      Structure:
      - Hook: A visionary opening line.
      - Body: One sentence on the strategic value delivered.
      - CTA: Professional closing.
      - Hashtags: 3 relevant industry tags.
      `,
    });
    return response.text || "";
  } catch (error) {
    console.error("Caption generation failed:", error);
    throw error;
  }
}

/**
 * Generates the social media post image via the n8n webhook.
 */
export async function generateSocialPost(
  accomplishment: string,
  logoBase64: string,
  styleRef: string | null
): Promise<string> {
  const WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-get";

  let promptText = "";

  if (styleRef) {
    promptText = `
Generate a sleek, vertical social media graphic for LinkedIn in a strict 4:5 aspect ratio, meticulously recreating the exact artistic style of the provided Style Reference Image (Image 2).

STYLE REPLICATION (CRITICAL):
- Precisely match every visual detail from Image 2: identical color palette, textural qualities, background composition, and overall aesthetic.
- The final design must appear as a seamless part of the exact same branded series.

TYPOGRAPHY:
- Center the text "${accomplishment}" prominently, using typography that exactly mirrors Image 2 in font weight, scale, and integration.
- Use DM Sans as the primary font.

BRANDING (STRICT):
- Place the provided "Barq Digital" logo (Image 1) exactly at the top center.
- Use the logo EXACTLY as provided.

CONTENT RESTRICTIONS:
- Include ONLY the logo and the centered text "${accomplishment}".
`;
  } else {
    promptText = `
Create a world-class, premium corporate announcement graphic for LinkedIn in a strict 4:5 portrait aspect ratio.

VISUAL ARCHITECTURE:
- BACKGROUND: Rich deep charcoal to true black gradient. Soft amber-orange (#FF8C00) and warm golden-yellow tones emanating diagonally.
- ATMOSPHERE: Modern luxury, digital innovation, quiet confidence.
- TYPOGRAPHY: "${accomplishment}" in DM Sans Bold. Large, centered, crisp white.
- BRANDING: "Barq Digital" logo (Image 1) exactly at the top center, small and discreet.

Final result: A breathtaking, professional visual statement of excellence.
`;
  }

  const formData = new FormData();
  formData.append('prompt', promptText);
  formData.append('accomplishment', accomplishment);

  try {
    const logoBlob = dataURLtoBlob(logoBase64);
    formData.append('logoImage', logoBlob, 'logo.png');
  } catch (e) {
    console.error("Error processing logo image:", e);
    throw new Error("Failed to process logo image.");
  }

  if (styleRef) {
    try {
      const styleBlob = dataURLtoBlob(styleRef);
      formData.append('styleImage', styleBlob, 'style_reference.png');
    } catch (e) {
      console.error("Error processing style image:", e);
      throw new Error("Failed to process style reference image.");
    }
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Generation failed with status: ${response.status}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert image to base64"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading image data"));
      reader.readAsDataURL(blob);
    });

  } catch (error: any) {
    console.error("Webhook error:", error);
    throw new Error(error.message || "Failed to connect to generation service.");
  }
}
