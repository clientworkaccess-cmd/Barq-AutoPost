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
 * Generates a sophisticated LinkedIn caption for an image post.
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
 * Generates the social media post image via the n8n webhook using the detailed prompts provided.
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
Generate a sleek, vertical social media graphic for LinkedIn in a strict 4:5 aspect ratio (portrait orientation, ideally 1080x1350 pixels), meticulously recreating the exact artistic style of the provided Style Reference Image (Image 2).

STYLE REPLICATION (CRITICAL):
- Precisely match every visual detail from Image 2: identical color palette (dominant hues, subtle gradients, accents, and tones), textural qualities (grain, noise, overlays, material finishes), background composition (layering, abstract elements, depth of field, lighting, and atmospheric mood), and overall aesthetic (modern minimalism with premium, sophisticated, motivational energy).
- The final design must appear as a seamless part of the exact same branded series — indistinguishable in style, harmony, and polish from the reference image.

TYPOGRAPHY:
- Center the text "${accomplishment}" prominently, using typography that exactly mirrors Image 2 in font weight (bold or semi-bold), letter spacing, casing (uppercase or lowercase as in reference), scale relative to the canvas, alignment, and integration.
- Use DM Sans as the primary font, or the closest high-end geometric sans-serif that achieves perfect fidelity to the reference.
- Ensure maximum legibility with high contrast, graceful positioning, balanced negative space, and subtle shadow/glow only if clearly present in the reference image.

BRANDING (STRICT):
- Place the provided "Barq Digital" logo (Image 1) exactly at the top center of the composition.
- Use the logo EXACTLY as provided — do NOT recolor, modify, add glow/shadow/effects, distort, or alter it in any way.
- Scale the logo to be noticeably small yet clearly visible and recognizable — not dominant or oversized, maintaining elegant restraint and allowing the accomplishment text to remain the focal point.

CONTENT RESTRICTIONS:
- Include ONLY two elements: the unchanged "Barq Digital" logo (small, top center) and the centered text "${accomplishment}".
- No additional text, icons, borders, embellishments, patterns, or calls-to-action — preserve absolute clean minimalism.

OVERALL DIRECTION:
- Deliver ultra-sharp, premium-quality rendering with balanced composition, subtle depth, and timeless sophistication.
- Evoke pride, achievement, innovation, and digital excellence while feeling like a natural continuation of the reference image’s visual collection.
- Create a highly polished, ready-to-post LinkedIn graphic that commands attention through restraint and elegance.

Final result must be visually stunning, emotionally resonant, and perfectly brand-consistent.
`;
  } else {
    promptText = `
Create a world-class, premium corporate announcement graphic for LinkedIn in a strict 4:5 portrait aspect ratio (1080x1350 pixels recommended). Deliver an ultra-polished, executive-level design with a creative yet professional edge.

VISUAL ARCHITECTURE & CREATIVE DIRECTION:
- BACKGROUND: A deeply immersive, cinematic minimalist composition. Start with a rich deep charcoal (#121212) to true black gradient as the base. Introduce a dynamic, creative multi-layered gradient: subtle soft amber-orange (#FF8C00 to #FFB84D) blending into warm golden-yellow tones, emanating diagonally from the bottom-left corner upward in a gentle, ethereal glow. Add a secondary faint teal-blue (#00A3AD) accent glow from the top-right for sophisticated contrast and depth. Incorporate very subtle film grain and micro-texture for a premium tactile feel — never noisy, always refined.
- ATMOSPHERE: Modern luxury meets digital innovation. Evoke quiet confidence, achievement, and forward momentum. Use soft volumetric light rays and delicate particle-like bokeh sparks in amber/gold to suggest energy and celebration without cluttering the minimalism.

TYPOGRAPHY (CRITICAL):
- Primary text: "${accomplishment}"
- Font: Exclusively DM Sans Bold (or the closest premium geometric sans-serif if unavailable).
- Style: Large, commanding headline size, perfectly centered vertically and horizontally. Crisp pure white (#FFFFFF) with maximum legibility and high contrast.
- Enhance with subtle creative flair: very faint outer glow in warm amber and a delicate drop shadow for depth and separation from the background. Letter spacing slightly expanded for modern elegance.

BRANDING (STRICT):
- Place the provided "Barq Digital" logo (Image 1) precisely at the top center.
- Use the logo EXACTLY as supplied — no recoloring, no effects, no modifications.
- Scale it small and discreet: elegantly restrained (approximately 10–12% of canvas width), ensuring it brands without competing with the main message.

COMPOSITION RULES:
- Absolute minimalism: ONLY the logo and the accomplishment text. No additional icons, lines, shapes, borders, or embellishments.
- Masterful use of negative space: generous breathing room around text and logo for an airy, high-authority executive feel.
- Perfect symmetry and balance with subtle creative asymmetry in the gradient flow for visual interest.

TECHNICAL QUALITY:
- Ultra-high resolution, razor-sharp details, flawless rendering.
- Professional color grading with rich blacks, vibrant yet controlled highlights, and cinematic contrast.
- Designed to stand out powerfully in LinkedIn feeds while feeling timeless and brand-consistent.

Final result: A breathtaking, emotionally resonant corporate announcement that transforms a simple achievement into a bold, inspiring visual statement of excellence.
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
