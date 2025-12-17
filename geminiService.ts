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
 * Uses process.env.API_KEY exclusively as per guidelines.
 * @param text - The original text.
 * @returns The enhanced text.
 */
export async function enhanceText(text: string): Promise<string> {
  try {
    // Standard initialization using process.env.API_KEY for Vercel/Environment compatibility
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rewrite the following text to be more professional, engaging, and suitable for a LinkedIn post about weekly accomplishments. 
      
      Rules:
      1. Fix grammar and spelling.
      2. Make it sound professional yet authentic.
      3. Keep it concise (under 50 words if possible, unless the input is very long).
      4. Do not add introductory text like "Here is the rewritten version:". Just output the text.
      
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
 * Uses process.env.API_KEY.
 * @param accomplishment - The user's achievement.
 * @returns A generated caption.
 */
export async function generateCaption(accomplishment: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a short, engaging LinkedIn caption for the following professional accomplishment. Include relevant hashtags.
      
      Accomplishment: "${accomplishment}"
      
      Rules:
      1. Tone: Professional, enthusiastic, grateful.
      2. Length: Short paragraph (2-3 sentences).
      3. Include 3-5 relevant hashtags at the end.
      4. Do not include quotes around the output.
      `,
    });
    return response.text || "";
  } catch (error) {
    console.error("Caption generation failed:", error);
    throw error;
  }
}

/**
 * Generates a social media post image using the n8n webhook.
 * Sends data as multipart/form-data with binary images.
 * 
 * @param accomplishment - The user's achievement text.
 * @param logoBase64 - The company logo in base64 format.
 * @param styleRef - (Optional) A style reference image in base64 format.
 * @returns The generated image as a base64 data URL.
 */
export async function generateSocialPost(
  accomplishment: string,
  logoBase64: string,
  styleRef: string | null
): Promise<string> {
  const WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-get";

  // Detailed prompt for the image generation service
  const promptText = `
    Create a vertical (aspect ratio 3:4) social media post image suitable for LinkedIn.

    INPUTS:
    - Image 1: The "Barq Digital" logo (lightning bolt icon).
    ${styleRef ? '- Image 2: A style reference image.' : ''}

    DESIGN REQUIREMENTS:
    1. COLOR PALETTE: Use dominant hues of Orange, Yellow, and Black.
    2. BACKGROUND: Create an imaginative gradient or sleek dark textured background. 
       ${styleRef ? 'Use Image 2 as a loose reference for the artistic vibe/texture, but do not copy it directly.' : ''}
    3. LAYOUT:
       - LOGO: Place Image 1 (the logo) at the TOP CENTER of the image. It must be legible and distinct.
       - TEXT: Render the text provided below in the CENTER of the image. Use a clean, modern, bold font that is easy to read against the background.

    TEXT CONTENT TO RENDER:
    "${accomplishment}"
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
