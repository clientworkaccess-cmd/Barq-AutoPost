import { GoogleGenAI } from "@google/genai";

/**
 * Helper to convert Base64 Data URL to Blob
 */
export function dataURLtoBlob(dataurl: string): Blob {
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
 * Enhances text using Gemini 3 Flash.
 */
export async function enhanceText(text: string): Promise<string> {
  if (!text) return "";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rewrite this professional accomplishment for a social media graphic. Keep it impactful, bold, and under 12 words. Output ONLY the polished text.\n\nInput: "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    console.error("Text enhancement failed:", error);
    return text;
  }
}

/**
 * Generates an engaging LinkedIn caption based on accomplishments.
 */
export async function generateCaption(accomplishment: string): Promise<string> {
  return generateCaptionWithTone(accomplishment, 'Corporate Professional');
}

/**
 * Specialized caption generation with tone support for Text Mode.
 */
export async function generateCaptionWithTone(accomplishment: string, tone: string): Promise<string> {
  if (!accomplishment) return "";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a professional, engaging LinkedIn post caption based on this engineering accomplishment: ${accomplishment}. 
      Tone: ${tone}.
      Rules:
      1. Keep it concise (under 200 words).
      2. Include 3-4 relevant hashtags at the end.
      3. Make it sound natural and authentic.
      4. Output ONLY the final caption text.
      5. NO introductions (like "Here is the caption").
      6. NO explanations.
      7. NO Markdown formatting (no **, no _, no # at the start of lines unless it's a hashtag).`,
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Caption generation failed:", error);
    return "";
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
  
  const promptText = `A high-end corporate announcement graphic in strict 4:5 aspect ratio. 
  Background: Deep orange and yellow gradient with subtle dark textures. 
  Foreground: Bold white professional text in the center: "${accomplishment}". 
  Requirement: Logo must be at the top center. 
  ${styleRef ? "Style match: Refer to the provided style image for aesthetics." : "Aesthetic: Modern, clean, professional engineering style."}`;

  const formData = new FormData();
  formData.append('prompt', promptText);
  formData.append('accomplishment', accomplishment);
  formData.append('logoImage', dataURLtoBlob(logoBase64), 'logo.png');
  if (styleRef) formData.append('styleImage', dataURLtoBlob(styleRef), 'style.png');

  const response = await fetch(WEBHOOK_URL, { method: 'POST', body: formData });
  if (!response.ok) throw new Error("Generation failed.");
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends edit data to the webhook and returns the processed image.
 */
export async function sendEditToWebhook(payload: {
  originalImage: string;
  editedImage?: string;
  prompt: string;
  type: 'visual' | 'text';
}): Promise<string | null> {
  const EDIT_WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/4d10ba4c-3102-452a-ae61-51d3d022cf14";
  const formData = new FormData();
  formData.append('originalImage', dataURLtoBlob(payload.originalImage), 'original.png');
  if (payload.editedImage) formData.append('editedImage', dataURLtoBlob(payload.editedImage), 'edited.png');
  formData.append('prompt', payload.prompt);
  formData.append('type', payload.type);

  try {
    const response = await fetch(EDIT_WEBHOOK_URL, { method: 'POST', body: formData });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Webhook edit sync error:", e);
    return null;
  }
}
