interface UploadResponse {
  upload_path: string;
  success: boolean;
}

export const UploadService = {
  /**
   * Uploads an image to S3 via the upload API
   * @param fileContent - Base64 encoded file content (including data URL prefix)
   * @param contentType - MIME type (e.g., 'image/png', 'image/jpeg')
   * @returns Promise with [upload_path, success] tuple
   */
  async uploadImage(fileContent: string, contentType: string): Promise<[string, boolean]> {
    try {
      const apiUrl = `/proxy/upload`;

      // Get auth token from localStorage
      const token = localStorage.getItem('access_token');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          file_content: fileContent,
          content_type: contentType,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
      }

      const data: UploadResponse = await response.json();
      return [data.upload_path, data.success];
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown upload error occurred');
    }
  },

  /**
   * Extracts content type from a data URL
   * @param dataUrl - Data URL string (e.g., 'data:image/png;base64,...')
   * @returns Content type string (e.g., 'image/png')
   */
  extractContentType(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+);/);
    if (match && match[1]) {
      return match[1];
    }
    // Default to PNG if unable to detect
    return 'image/png';
  },
};
