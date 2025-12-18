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
 * Generates the social media post image via the n8n webhook.
 * Dynamically switches prompts based on whether a style reference image is provided.
 */
export async function generateSocialPost(
  accomplishment: string,
  logoBase64: string,
  styleRef: string | null
): Promise<string> {
  const WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-get";

  let promptText = "";

  if (styleRef) {
    // PROMPT WHEN STYLE REFERENCE IS PROVIDED
    promptText = `
      Create a vertical social media post (4:5 aspect ratio) for LinkedIn that precisely mimics the artistic style of the provided "Style Image" (Image 2).
      
      STRICT REQUIREMENTS:
      1. STYLE REFERENCE: Deeply analyze Image 2. Extract its specific color palette, textural qualities, background depth, and overall aesthetic vibe. Apply this style to the new image.
      2. TYPOGRAPHY: Observe the font weight, casing, and positioning in Image 2. Use a similar professional style for the text "${accomplishment}". 
         - Prefer DM Sans or a high-end geometric sans-serif that fits the reference.
         - Ensure the text is perfectly legible and elegantly integrated into the reference style.
      3. BRANDING: Place the "Barq Digital" logo (Image 1) at the TOP CENTER. It must be cleanly visible and consistent with the new style.
      4. CONTENT: Only display the logo and the text: "${accomplishment}".
      
      Ensure the resulting design looks like it belongs to the same collection as the reference image but features the new logo and accomplishment.
    `;
  } else {
    // CONSTANT DEFAULT PROMPT WHEN NO STYLE IMAGE IS PROVIDED
    promptText = `
      Create a world-class, premium corporate announcement image for LinkedIn.
      ASPECT RATIO: 4:5 (Portrait).
      
      VISUAL ARCHITECTURE (Standard Barq Style):
      - BACKGROUND: A sleek, professional minimalist aesthetic. Use a sophisticated deep charcoal (#121212) to black gradient. Add a cinematic soft amber/orange (#FF8C00) or yellow glow emanating subtly from one corner.
      - TYPOGRAPHY: 
          * PRIMARY FONT: Must use "DM Sans Bold". 
          * TEXT: Display the message: "${accomplishment}".
          * STYLING: Large, impactful typography centered perfectly. Crisp white text.
      - BRANDING:
          * LOGO (Image 1): Positioned cleanly at the TOP CENTER.
      - ARTISTIC DIRECTION:
          * Minimalist, modern, and high-authority.
          * Focus on professional hierarchy and elegant spacing.

      Ensure a high-resolution, executive look.
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
