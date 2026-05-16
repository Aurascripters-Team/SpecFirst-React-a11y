import { useState } from "react";

type Option = {
  label: string;
  value: string;
};

type PickerProps = {
  label: string;
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
};

export const Picker = ({ label, options, value, onChange }: PickerProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      <button
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls="picker-listbox"
        aria-activedescendant={`picker-option-${activeIndex}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            setActiveIndex(0);
            setOpen(true);
          }
        }}
      >
        {value ?? "Choose fruit"}
      </button>
      {open && (
        <ul id="picker-listbox" role="listbox">
          {options.map((option) => (
            <li
              id={`picker-option-${option.value}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
