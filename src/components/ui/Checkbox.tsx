export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function Checkbox({ checked, onChange, disabled = false, label }: CheckboxProps) {
  return (
    <label className="inline-flex items-center gap-2 text-body-md text-on-surface">
      <button
        type="button"
        aria-checked={checked}
        role="checkbox"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 border-primary transition-all duration-150 ${
          checked ? 'bg-primary' : 'bg-white'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        {checked ? <span className="material-symbols-outlined text-[18px] leading-none text-white">check</span> : null}
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export default Checkbox;
