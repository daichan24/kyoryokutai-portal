import { useState, useRef, useEffect } from 'react';

interface UseModalCloseConfirmationOptions {
  hasChanges: () => boolean;
  onConfirmClose: () => void;
  onCancelClose?: () => void;
}

export const useModalCloseConfirmation = ({
  hasChanges,
  onConfirmClose,
  onCancelClose,
}: UseModalCloseConfirmationOptions) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    if (hasChanges()) {
      setShowConfirmDialog(true);
    } else {
      onConfirmClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onConfirmClose();
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
    if (onCancelClose) {
      onCancelClose();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [hasChanges]);

  return {
    modalRef,
    showConfirmDialog,
    handleClose,
    handleConfirmClose,
    handleCancelClose,
  };
};

