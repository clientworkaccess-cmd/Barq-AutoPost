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
 * Follows strict user formatting requirements.
 */
export async function generateCaption(accomplishment: string): Promise<string> {
  if (!accomplishment) return "";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a professional, engaging LinkedIn post caption based on this engineering accomplishment: ${accomplishment}. Keep it concise (under 200 words), include relevant hashtags at the end, and make it sound natural and authentic. Output ONLY the final caption text — no introductions, no explanations, no Markdown formatting like ** or _, no phrases like 'Here is the caption'.`,
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
 * Generates a new image based on text edit instructions.
 */
export async function generateImageEdit(originalImageBase64: string, instructions: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const mimeType = originalImageBase64.split(';')[0].split(':')[1];
    const base64Data = originalImageBase64.split(',')[1];
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: `Modify this 4:5 social media post according to these instructions: ${instructions}. Maintain the aspect ratio and overall branding.` }
        ]
      }
    });
    const part = response.candidates![0].content.parts.find(p => p.inlineData);
    if (!part) throw new Error("No image returned from Gemini Edit.");
    return `data:${part.inlineData!.mimeType};base64,${part.inlineData!.data}`;
  } catch (error) {
    console.error("Edit generation failed:", error);
    throw error;
  }
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
