import { useState } from "react";

type Option = {
  label: string;
  value: string;
};

type SelectOnlyComboboxProps = {
  label: string;
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function SelectOnlyCombobox({
  label,
  options,
  value,
  onChange,
  disabled,
  className,
}: SelectOnlyComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={className}>
      <span>{label}</span>
      <button disabled={disabled} onClick={() => setOpen(!open)}>
        {selected?.label ?? "Choose fruit"}
      </button>
      {open && (
        <ul className="combo-list">
          {options.map((option) => (
            <li
              key={option.value}
              className="combo-option"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
