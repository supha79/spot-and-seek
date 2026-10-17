import type { ReactNode } from 'react';
import { BackButton } from '../ui/BackButton';
import { Logo } from '../ui/Logo';

export type HeaderProps = {
  children?: ReactNode;
};

export function Header({ children }: HeaderProps) {
  return (
    <header className="flex w-full items-center justify-between px-4 py-2 sm:px-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <Logo className="h-10 w-auto" />
      </div>
      {children ? <div className="flex items-center gap-3">{children}</div> : null}
    </header>
  );
}

export default Header;
