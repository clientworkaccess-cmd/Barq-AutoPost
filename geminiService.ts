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
 * Enhances the user's text using Gemini 3 Flash.
 * Focuses on professional brevity and impact.
 */
export async function enhanceText(text: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rewrite the following text into a high-impact, professional LinkedIn announcement.
      
      Rules:
      1. Extreme Conciseness: Maximum 20 words.
      2. Professional Tone: Use powerful action verbs (e.g., "Optimized," "Engineered," "Delivered").
      3. Focus on Results: Highlight the outcome or value.
      4. Output ONLY the rewritten text, no quotes or intro.
      
      Input Text: "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    console.error("Text enhancement failed:", error);
    throw error;
  }
}

/**
 * Generates a LinkedIn caption based on the accomplishment.
 */
export async function generateCaption(accomplishment: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a sophisticated, engaging LinkedIn caption for this achievement.
      
      Accomplishment: "${accomplishment}"
      
      Rules:
      1. Tone: Visionary and professional.
      2. Structure: One impactful hook, one short detail, 3-5 hashtags.
      3. Length: Maximum 280 characters.
      4. Output only the caption.
      `,
    });
    return response.text || "";
  } catch (error) {
    console.error("Caption generation failed:", error);
    throw error;
  }
}

/**
 * Generates the social media post image via the n8n webhook with a premium design prompt.
 */
export async function generateSocialPost(
  accomplishment: string,
  logoBase64: string,
  styleRef: string | null
): Promise<string> {
  const WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-get";

  // Highly refined prompt for professional corporate design
  const promptText = `
    Create a premium, professional corporate announcement image. 
    ASPECT RATIO: 4:5 (vertical).
    
    AESTHETIC:
    - Background: A sophisticated, dark, minimal gradient transitioning from deep charcoal/black to a subtle, warm glowing orange in one corner.
    - Texture: Very subtle matte finish or high-end architectural grain.
    - Style: Modern, clean, and high-authority corporate branding.
    ${styleRef ? '- Artistic Influence: Incorporate the vibe and color harmony of Image 2 subtly into the background.' : ''}

    ELEMENTS:
    1. LOGO (Image 1): Positioned at the TOP CENTER. Ensure it is clean, medium-sized, and stands out with high contrast.
    2. MAIN TEXT: Render the text "${accomplishment}" in the CENTER.
       - FONT: Use "DM Sans Bold" or a similar high-end geometric sans-serif.
       - TYPOGRAPHY: Large font size, perfect tracking, and leading. White or light-ivory text color for maximum legibility against the dark background.
       - ALIGNMENT: Perfectly centered horizontally and vertically.

    DO NOT include any secondary text, watermarks, or cluttered UI elements. The focus must be purely on the logo and the accomplishment.
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
          reject(new Error("Failed to convert response blob to base64"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read response blob"));
      reader.readAsDataURL(blob);
    });

  } catch (error: any) {
    console.error("Webhook error:", error);
    throw new Error(error.message || "Failed to connect to generation service.");
  }
}
