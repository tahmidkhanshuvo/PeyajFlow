"use client";

import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "./icon";

export interface DropdownOption {
  value: string;
  label: string;
}

export function WorkspaceDropdown({
  name,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  required = false,
  id,
  className = "",
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!open) return;
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const isPlaceholder = !value || (selectedOption && selectedOption.value === "");

  return (
    <div
      ref={containerRef}
      className={`workspace-dropdown-wrap ${open ? "is-open" : ""} ${className}`}
    >
      <input type="hidden" name={name} value={value} required={required} />
      <button
        id={id}
        type="button"
        disabled={disabled}
        className={`workspace-dropdown-btn ${isPlaceholder ? "is-placeholder" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dropdown-btn-label">{displayLabel}</span>
        <span
          className={`dropdown-btn-chevron ${open ? "is-rotated" : ""}`}
          aria-hidden="true"
        >
          <WorkspaceIcon name="chevronDown" size={16} />
        </span>
      </button>

      {open && (
        <div className="workspace-dropdown-popup" role="listbox">
          <div className="workspace-dropdown-scroll">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`workspace-dropdown-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="dropdown-item-label">{opt.label}</span>
                  {isSelected && (
                    <span className="dropdown-item-check" aria-hidden="true">
                      <WorkspaceIcon name="check" size={15} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
