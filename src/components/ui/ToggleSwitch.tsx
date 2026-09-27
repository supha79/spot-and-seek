export type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      aria-checked={checked}
      role="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[30px] w-[52px] items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-secondary-container' : 'bg-surface-container-high'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      style={{ boxShadow: checked ? 'inset 0 0 0 1px rgba(44,105,86,0.12)' : 'inset 0 0 0 1px rgba(112,120,126,0.08)' }}
    >
      <span
        className={`absolute h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_8px_rgba(23,28,30,0.18)] transition-transform duration-200 ${
          checked ? 'translate-x-[26px]' : 'translate-x-[4px]'
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
