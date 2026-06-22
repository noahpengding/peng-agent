/**
 * Parses a Python bytes literal string (e.g., b'\x89PNG...') into a Uint8Array
 */
export const parsePythonBytes = (str: string): Uint8Array | null => {
  const trimmed = str.trim();
  if (!trimmed.startsWith("b'") || !trimmed.endsWith("'")) return null;
  
  const content = trimmed.substring(2, trimmed.length - 1);
  const result: number[] = [];
  
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\\') {
      if (content[i + 1] === 'x') {
        const hex = content.substring(i + 2, i + 4);
        result.push(parseInt(hex, 16));
        i += 3;
      } else if (content[i + 1] === '\\') {
        result.push(92); // \
        i++;
      } else if (content[i + 1] === "'") {
        result.push(39); // '
        i++;
      } else if (content[i + 1] === 'n') {
        result.push(10); // \n
        i++;
      } else if (content[i + 1] === 'r') {
        result.push(13); // \r
        i++;
      } else if (content[i + 1] === 't') {
        result.push(9); // \t
        i++;
      } else {
        result.push(content.charCodeAt(i));
      }
    } else {
      result.push(content.charCodeAt(i));
    }
  }
  return new Uint8Array(result);
};

/**
 * Detects the MIME type of a binary buffer and converts it to a data URL
 */
export const binaryToDataUrl = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  
  // Detect MIME type based on magic numbers
  let mimeType = 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mimeType = 'image/jpeg';
  } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    mimeType = 'image/gif';
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    mimeType = 'image/png';
  } else if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    mimeType = 'image/bmp';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    mimeType = 'image/webp';
  }
  
  return `data:${mimeType};base64,${base64}`;
};
