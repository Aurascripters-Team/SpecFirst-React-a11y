import { useMemo, useState } from "react";

type PickerItem = {
  id: string;
  label: string;
  value: string;
  href?: string;
  kind: "fruit" | "action" | "route";
  disabled?: boolean;
  danger?: boolean;
};

type CurveballPickerProps = {
  label: string;
  items: PickerItem[];
  value?: string;
  selectedValues?: string[];
  onChange: (value: string) => void;
  onNavigate?: (href: string) => void;
  onDelete?: (id: string) => void;
  onCreate?: (label: string) => void;
  className?: string;
};

export function CurveballPicker({
  label,
  items,
  value,
  selectedValues = [],
  onChange,
  onNavigate,
  onDelete,
  onCreate,
  className,
}: CurveballPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues);

  const visibleItems = useMemo(() => {
    return items.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    );
  }, [items, query]);

  const selectedLabel =
    items.find((item) => item.value === value)?.label ?? "Choose fruit";

  function toggleValue(nextValue: string) {
    setLocalSelected((current) =>
      current.includes(nextValue)
        ? current.filter((item) => item !== nextValue)
        : [...current, nextValue],
    );

    onChange(nextValue);
  }

  return (
    <section className={className}>
      <label id="curveball-label">{label}</label>

      <button
        type="button"
        aria-labelledby="curveball-label"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="curveball-popup"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveId(visibleItems[0]?.id ?? null);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        {localSelected.length > 0
          ? `${localSelected.length} selected`
          : selectedLabel}
      </button>

      {open && (
        <div id="curveball-popup" className="picker-popover">
          <input
            aria-label={`Search ${label}`}
            value={query}
            placeholder="Search or create"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim() && onCreate) {
                onCreate(query.trim());
              }
            }}
          />

          {query.trim() && (
            <button type="button" onClick={() => onCreate?.(query.trim())}>
              Create “{query}”
            </button>
          )}

          <ul role="listbox" aria-labelledby="curveball-label">
            {visibleItems.map((item) => (
              <li
                key={item.id}
                id={`curveball-option-${item.id}`}
                role="option"
                aria-selected={localSelected.includes(item.value)}
                data-active={activeId === item.id}
                onMouseEnter={() => setActiveId(item.id)}
              >
                {item.href ? (
                  <a
                    href={item.href}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate?.(item.href!);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </a>
                ) : item.kind === "action" ? (
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      onDelete?.(item.id);
                      setOpen(false);
                    }}
                  >
                    {item.danger ? "Delete" : "Run"} {item.label}
                  </button>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={localSelected.includes(item.value)}
                      disabled={item.disabled}
                      onChange={() => toggleValue(item.value)}
                    />
                    {item.label}
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
