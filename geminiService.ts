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
 * Access the API key from Vite environment variables as requested.
 * Fallback to process.env.API_KEY if needed, though the user requested VITE_API_KEY explicitly.
 */
const API_KEY = (import.meta as any).env.VITE_API_KEY || (process as any).env.API_KEY;

/**
 * Enhances the user's text using Gemini 3 Flash.
 * Focuses on professional brevity, high-status language, and impact.
 */
export async function enhanceText(text: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rewrite this professional accomplishment into a high-impact corporate headline.
      
      Rules:
      1. Length: 10-15 words maximum.
      2. Tone: Sophisticated, authoritative, results-driven.
      3. Style: Start with a strong verb. Use high-value business vocabulary.
      4. Output: ONLY the text. No quotes.
      
      Input: "${text}"`,
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
 * Generates the social media post image via the n8n webhook with a premium corporate aesthetic.
 */
export async function generateSocialPost(
  accomplishment: string,
  logoBase64: string,
  styleRef: string | null
): Promise<string> {
  const WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-get";

  const promptText = `
    Create a world-class, premium corporate announcement image for LinkedIn.
    ASPECT RATIO: 4:5 (Portrait).
    
    VISUAL ARCHITECTURE:
    - BACKGROUND: A sleek, professional minimalist aesthetic. Use a sophisticated deep charcoal (#121212) to black gradient. Add a cinematic soft amber/orange (#FF8C00) or yellow glow emanating subtly from one corner.
    - TYPOGRAPHY: 
        * PRIMARY FONT: Must use "DM Sans" (Bold or Extra Bold). 
        * TEXT: Display the message: "${accomplishment}".
        * STYLING: Large, impactful typography. Perfect center alignment. Crisp white or light ivory text color.
    - BRANDING:
        * LOGO (Image 1): Positioned cleanly at the TOP CENTER. It should be perfectly integrated into the high-end design.
    - ARTISTIC DIRECTION:
        * Minimalist, modern, and high-authority.
        * Focus on professional hierarchy and elegant spacing.
        ${styleRef ? '* REFERENCES: Subtly incorporate the color harmony or textural quality of Image 2 into the background elements.' : ''}

    Ensure the final result is high-resolution and suitable for an executive LinkedIn feed.
  `;

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
