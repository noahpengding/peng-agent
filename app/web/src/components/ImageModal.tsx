import React from 'react';

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ src, onClose }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = src;
    // Extract format from data URL if possible, otherwise default to png
    const match = src.match(/^data:image\/(\w+);base64,/);
    const extension = match ? match[1] : 'png';
    link.download = `downloaded_image_${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <img src={src} alt="Enlarged" className="image-modal-img" />
        <div className="image-modal-actions">
          <button className="image-modal-download" onClick={handleDownload}>
            Download Image
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
