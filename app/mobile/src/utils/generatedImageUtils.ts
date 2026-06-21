const IMAGE_GENERATION_TOOL_NAME = 'image_generation_tool';
const GENERATED_IMAGE_PATH_SEGMENT = '/generated_images/';
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;

export const isImageGenerationToolCall = (content?: string): boolean => {
  return typeof content === 'string' && content.includes(`Tool Call: ${IMAGE_GENERATION_TOOL_NAME}`);
};

export const extractGeneratedImageUrl = (content: string): string | null => {
  const candidate = content.trim().replace(/^<|>$/g, '').replace(/^["']|["']$/g, '');
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const isHttpUrl = url.protocol === 'http:' || url.protocol === 'https:';
    const looksLikeGeneratedImage = url.pathname.includes(GENERATED_IMAGE_PATH_SEGMENT) || IMAGE_EXTENSION_PATTERN.test(url.pathname);

    return isHttpUrl && looksLikeGeneratedImage ? url.toString() : null;
  } catch {
    return null;
  }
};
