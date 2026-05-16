import { useState } from "react";

type ActionItem = {
  label: string;
  value: string;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
};

type EdgeCasePickerProps = {
  label: string;
  options: ActionItem[];
  value?: string;
  onChange: (value: string) => void;
  onDelete?: (value: string) => void;
  className?: string;
};

export function EdgeCasePicker({
  label,
  options,
  value,
  onChange,
  onDelete,
  className,
}: EdgeCasePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValues, setSelectedValues] = useState<string[]>(
    value ? [value] : [],
  );

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className={className}>
      <span>{label}</span>

      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {selectedValues.length > 0
          ? `${selectedValues.length} selected`
          : "Choose actions"}
      </button>

      {open && (
        <div className="picker-popup">
          <input
            aria-label={`Search ${label}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search options"
          />

          <ul className="picker-list">
            {filteredOptions.map((option) => (
              <li key={option.value} className="picker-option">
                {option.href ? (
                  <a href={option.href}>{option.label}</a>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option.value)}
                      disabled={option.disabled}
                      onChange={(event) => {
                        const checked = event.target.checked;

                        setSelectedValues((current) =>
                          checked
                            ? [...current, option.value]
                            : current.filter((item) => item !== option.value),
                        );

                        onChange(option.value);
                      }}
                    />
                    {option.label}
                  </label>
                )}

                {option.danger && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(option.value)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
