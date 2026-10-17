import { BrandMascot } from './BrandMascot';
import { Button } from './Button';
import { Modal } from './Modal';

type LogoutConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  authError: string | null;
};

export function LogoutConfirmationModal({ isOpen, onClose, onConfirm, isLoading, authError }: LogoutConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm" size="sm">
      <div className="relative space-y-space-md p-space-md sm:p-space-lg">
        <span className="material-symbols-outlined absolute left-space-lg top-space-lg text-[16px] text-tertiary" aria-hidden="true">auto_awesome</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close logout confirmation"
          className="absolute right-space-lg top-space-lg flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>

        <div className="pt-space-sm text-center">
          <BrandMascot className="mx-auto h-16 w-16" />
          <h2 className="mt-space-xs text-headline-md text-on-surface">Log out?</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">ต้องการออกจากระบบใช่ไหม</p>
        </div>

        <div className="rounded-md border border-primary-fixed bg-surface-container-low px-space-md py-space-sm text-center">
          <p className="text-label-sm text-on-primary-fixed-variant">
            ความคืบหน้าและการค้นพบทั้งหมดของคุณถูกบันทึกไว้อย่างปลอดภัยแล้ว แล้วกลับมาเล่นด้วยกันใหม่นะ! <span className="text-tertiary">✦</span>
          </p>
        </div>

        {authError ? <p role="alert" className="text-body-sm text-error">{authError}</p> : null}

        <div className="grid grid-cols-2 gap-space-sm">
          <Button variant="ghost" onClick={onClose} className="w-full whitespace-nowrap !border-primary-container !text-on-primary-container">
            Cancel
          </Button>
          <Button variant="tertiary" leftIcon="logout" onClick={onConfirm} disabled={isLoading} className="w-full whitespace-nowrap">
            Log out
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default LogoutConfirmationModal;