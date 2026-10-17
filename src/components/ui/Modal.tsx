import { useEffect, type ReactNode } from 'react';
import { Card, type CardSize } from './Card';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  size?: CardSize;
};

export function Modal({ isOpen, onClose, children, className = 'max-w-lg', size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,65,79,0.35)] backdrop-blur"
      onClick={onClose}
      role="presentation"
    >
      <div className={`ui-pop-in w-full px-4 ${className}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <Card className="overflow-hidden p-0" size={size} style={{ boxShadow: '0 20px 40px -8px rgba(35,65,79,0.15)' }}>
          {children}
        </Card>
      </div>
    </div>
  );
}

export default Modal;
