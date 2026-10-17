import { useState } from 'react';

export type InputProps = {
  type?: 'text' | 'email' | 'number' | 'password' | 'search';
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  leftIcon?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  required?: boolean;
};

export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  leftIcon,
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
  min,
  max,
  step,
  required = false,
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordType = type === 'password';
  const inputType = isPasswordType && isPasswordVisible ? 'text' : type;

  return (
    <div className="relative w-full">
      {leftIcon ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] leading-none">
            {leftIcon}
          </span>
        </span>
      ) : null}

      <input
        id={id}
        aria-label={ariaLabel}
        type={inputType}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        required={required}
        className={`w-full rounded bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-[0_0_0_3px_rgba(124,200,240,0.4)] ${
          leftIcon ? 'pl-11' : ''
        } ${className}`}
      />

      {isPasswordType ? (
        <button
          type="button"
          aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
          onClick={() => setIsPasswordVisible((current) => !current)}
          className="ui-pressable absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] leading-none">
            {isPasswordVisible ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      ) : null}
    </div>
  );
}

export default Input;
