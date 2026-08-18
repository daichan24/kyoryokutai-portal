import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';

interface InspectionAttachmentImageProps {
  inspectionId: string;
  attachmentId: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}

/** 添付画像は認証必須のAPIから取得するため、blob URLに変換して表示する */
export const InspectionAttachmentImage: React.FC<InspectionAttachmentImageProps> = ({
  inspectionId,
  attachmentId,
  alt,
  style,
  className,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .get(`/api/inspections/${inspectionId}/attachments/${attachmentId}`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch((error) => {
        console.error('Failed to load inspection attachment:', error);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, attachmentId]);

  if (!blobUrl) {
    return (
      <div
        className={className}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', color: '#9ca3af', fontSize: '11px' }}
      >
        読み込み中...
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} style={style} className={className} />;
};
