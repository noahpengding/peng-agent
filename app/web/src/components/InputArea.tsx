import React, { useRef, useEffect, useState, useCallback } from 'react';
import { UploadService } from '@share/services/uploadService';
import { UploadedImage } from '@share/types/ChatInterface.types';

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  s3PathsInput: string;
  setS3PathsInput: (value: string) => void;
  uploadedImages: UploadedImage[];
  setUploadedImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onError: (error: string) => void;
  maxInputChars?: number;
  maxTextareaHeight?: number;
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  s3PathsInput,
  setS3PathsInput,
  uploadedImages,
  setUploadedImages,
  isLoading,
  onSubmit,
  onError,
  maxInputChars = 4000,
  maxTextareaHeight = 240,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const isUploading = uploadingCount > 0;
  const maxAttachments = 10;

  const isImageType = (contentType: string) => contentType.startsWith('image/');

  // Helper: adjust textarea height based on content up to max
  const adjustTextareaSize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, maxTextareaHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxTextareaHeight ? ('auto' as const) : ('hidden' as const);
  }, [maxTextareaHeight]);

  // Adjust when content changes
  useEffect(() => {
    adjustTextareaSize();
  }, [input, adjustTextareaSize]);

  // Handle file processing and upload
  const processAndUploadFile = async (file: File) => {
    setUploadingCount((prev) => prev + 1);
    const reader = new FileReader();

    reader.onload = async (event) => {
      if (event.target?.result) {
        const base64Data = event.target.result as string;
        const contentType = UploadService.extractContentType(base64Data);

        try {
          const [uploadPath, success] = await UploadService.uploadFile(base64Data, contentType, file.name);

          if (success) {
            // Keep image previews for image files; for PDFs render a document-style chip.
            setUploadedImages((prev) => [
              ...prev,
              {
                path: uploadPath,
                preview: isImageType(contentType) ? base64Data : '',
                fileName: file.name,
                contentType,
              },
            ]);
          } else {
            onError('File upload failed. Please try again.');
          }
        } catch (error) {
          onError(`File upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setUploadingCount((prev) => Math.max(0, prev - 1));
        }
      }
    };

    reader.onerror = () => {
      onError('Failed to read file.');
      setUploadingCount((prev) => Math.max(0, prev - 1));
    };

    reader.readAsDataURL(file);
  };

  // Function to handle file uploads from file input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const remainingSlots = maxAttachments - uploadedImages.length;
      const filesToProcess = Math.min(files.length, remainingSlots);

      if (filesToProcess < files.length) {
        onError(`Only ${remainingSlots} more file(s) can be added. Maximum is ${maxAttachments} files.`);
      }

      for (let i = 0; i < filesToProcess; i++) {
        processAndUploadFile(files[i]);
      }
    }
  };

  // Function to handle clearing a specific image
  const handleClearImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Function to handle keyboard events for the textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter to submit the form
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      onSubmit(e as React.FormEvent);
    }
  };

  // Function to handle paste events (for images)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processAndUploadFile(blob);
            break;
          }
        }
      }
    }
  };

  return (
    <div className="input-container">
      <form onSubmit={onSubmit} className="input-form">
        <div className="s3-input-row">
          <input
            type="text"
            className="s3-input"
            value={s3PathsInput}
            onChange={(e) => setS3PathsInput(e.target.value)}
            placeholder="Add S3 paths (comma-separated)"
            aria-label="S3 paths"
            disabled={isLoading || isUploading}
          />
        </div>
        {/* File previews */}
        {uploadedImages.length > 0 && (
          <div className="image-preview-list">
            {uploadedImages.map((img, index) => (
              <div key={index} className="image-preview-container">
                {isImageType(img.contentType) ? (
                  <img src={img.preview} alt={img.fileName || 'Preview'} className="image-preview" />
                ) : (
                  <div className="file-preview-badge" title={img.fileName || img.path}>
                    <span className="file-preview-icon">PDF</span>
                    <span className="file-preview-name">{img.fileName || 'document.pdf'}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleClearImage(index)}
                  className="clear-image-button"
                  title="Remove file"
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="input-row">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= maxInputChars) {
                setInput(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type your message... (Ctrl+Enter to send)"
            aria-label="Message input"
            className="input-textarea"
            disabled={isLoading || isUploading}
            rows={1}
          />
          <div className="char-counter">
            {input.length}/{maxInputChars}
          </div>
          <div className="input-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="file-input"
              disabled={isLoading || isUploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="upload-button"
              title="Upload image or PDF"
              aria-label="Upload image or PDF"
              disabled={isLoading || isUploading}
            >
              {isUploading ? '⏳' : '📎'}
            </button>
            <button
              type="submit"
              className="send-button"
              aria-label="Send message"
              disabled={isLoading || isUploading || (!input.trim() && uploadedImages.length === 0 && s3PathsInput.trim().length === 0)}
            >
              ➤
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
