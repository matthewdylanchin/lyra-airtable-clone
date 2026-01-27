"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Sparkles } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { FilterCondition } from "../types";

interface Column {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER";
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  conjunctionMode?: "and" | "or";
  onConjunctionModeChange?: (mode: "and" | "or") => void;
}

interface CustomDropdownProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}

function CustomDropdown({
  value,
  options,
  onChange,
  className = "",
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm transition-colors hover:border-zinc-300"
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-zinc-400"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TEXT_OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "empty", label: "is empty" },
  { value: "not_empty", label: "is not empty" },
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "empty", label: "is empty" },
  { value: "not_empty", label: "is not empty" },
];

export default function FilterPanel({
  isOpen,
  onClose,
  columns,
  filters,
  onChange,
  triggerRef,
  conjunctionMode = "and",
  onConjunctionModeChange,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // ========================================
  // LOCAL STATE - prevents query spam
  // ========================================
  const [localFilters, setLocalFilters] = useState(filters);
  const [localConjunctionMode, setLocalConjunctionMode] =
    useState(conjunctionMode);

  // Sync local state when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    setLocalConjunctionMode(conjunctionMode);
  }, [conjunctionMode]);

  // Track if user has made changes
  const hasChanges = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen || !triggerRef?.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: rect.bottom + 8,
          left: rect.right - 680,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        // Apply changes when clicking outside
        if (hasChanges.current) {
          onChange(localFilters);
          onConjunctionModeChange?.(localConjunctionMode);
          hasChanges.current = false;
        }
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Apply changes on escape
        if (hasChanges.current) {
          onChange(localFilters);
          onConjunctionModeChange?.(localConjunctionMode);
          hasChanges.current = false;
        }
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    isOpen,
    onClose,
    triggerRef,
    localFilters,
    localConjunctionMode,
    onChange,
    onConjunctionModeChange,
  ]);

  const addCondition = () => {
    const newFilters: FilterCondition[] = [
      ...localFilters,
      {
        id: uuidv4(),
        columnId: columns[0]?.id ?? "",
        operator: "contains" as const,
        value: "",
      },
    ];
    setLocalFilters(newFilters);
    hasChanges.current = true;
  };

  const removeCondition = (id: string) => {
    const newFilters = localFilters.filter((f) => f.id !== id);
    setLocalFilters(newFilters);
    hasChanges.current = true;

    // Apply immediately when removing
    onChange(newFilters);
  };

  const updateCondition = <K extends keyof FilterCondition>(
    id: string,
    key: K,
    value: FilterCondition[K],
  ) => {
    const newFilters = localFilters.map((f) =>
      f.id === id ? { ...f, [key]: value } : f,
    );
    setLocalFilters(newFilters);
    hasChanges.current = true;
  };

  const handleConjunctionChange = (mode: "and" | "or") => {
    setLocalConjunctionMode(mode);
    hasChanges.current = true;

    // Apply immediately when changing conjunction
    onConjunctionModeChange?.(mode);
  };

  // Apply filters on Enter key
  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (hasChanges.current) {
        onChange(localFilters);
        onConjunctionModeChange?.(localConjunctionMode);
        hasChanges.current = false;
      }
    }
  };

  // Apply filters on blur (when user clicks away from input)
  const handleValueBlur = () => {
    if (hasChanges.current) {
      onChange(localFilters);
      onConjunctionModeChange?.(localConjunctionMode);
      hasChanges.current = false;
    }
  };

  const getOperatorsForColumn = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.type === "NUMBER" ? NUMBER_OPERATORS : TEXT_OPERATORS;
  };

  const needsValueInput = (operator: string) =>
    !["empty", "not_empty"].includes(operator);

  if (!isOpen || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[680px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-900">Filter</h3>
        <button
          onClick={() => {
            // Apply changes when closing
            if (hasChanges.current) {
              onChange(localFilters);
              onConjunctionModeChange?.(localConjunctionMode);
              hasChanges.current = false;
            }
            onClose();
          }}
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X size={16} />
        </button>
      </div>

      {/* AI Prompt */}
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:border-zinc-300">
          <Sparkles size={14} className="flex-shrink-0 text-purple-500" />
          <input
            className="flex-1 text-sm outline-none placeholder:text-zinc-400"
            placeholder="Describe what you want to see"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3">
        <div className="mb-3 text-xs text-zinc-600">
          In this view, show records
        </div>

        <div className="space-y-2">
          {localFilters.length === 0 ? (
            <div className="rounded-md py-8 text-center">
              <div className="mb-1 text-sm text-zinc-500">
                No filter conditions are applied
              </div>
            </div>
          ) : (
            localFilters.map((condition, index) => {
              const operators = getOperatorsForColumn(condition.columnId).map(
                (op) => ({
                  value: op.value,
                  label: op.label,
                }),
              );

              return (
                <div key={condition.id} className="flex items-center gap-2">
                  {index === 0 ? (
                    <span className="w-[52px] text-xs font-medium text-zinc-700">
                      Where
                    </span>
                  ) : index === 1 ? (
                    <CustomDropdown
                      value={localConjunctionMode}
                      options={[
                        { value: "and", label: "and" },
                        { value: "or", label: "or" },
                      ]}
                      onChange={(v) =>
                        handleConjunctionChange(v as "and" | "or")
                      }
                      className="w-[52px]"
                    />
                  ) : (
                    <span className="w-[52px] text-xs font-medium text-zinc-700">
                      {localConjunctionMode === "and" ? "And" : "Or"}
                    </span>
                  )}

                  <CustomDropdown
                    value={condition.columnId}
                    options={columns.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    onChange={(v) => {
                      updateCondition(condition.id, "columnId", v);
                      // Apply immediately when changing column
                      onChange(
                        localFilters.map((f) =>
                          f.id === condition.id ? { ...f, columnId: v } : f,
                        ),
                      );
                    }}
                    className="w-[120px]"
                  />

                  <CustomDropdown
                    value={condition.operator}
                    options={operators}
                    onChange={(v) => {
                      updateCondition(
                        condition.id,
                        "operator",
                        v as FilterCondition["operator"],
                      );
                    }}
                    className="w-[120px]"
                  />

                  {needsValueInput(condition.operator) && (
                    <input
                      value={condition.value ?? ""}
                      onChange={(e) =>
                        updateCondition(condition.id, "value", e.target.value)
                      }
                      onKeyDown={handleValueKeyDown}
                      onBlur={handleValueBlur}
                      className="flex-1 rounded border border-zinc-200 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none"
                      placeholder="Enter a value"
                    />
                  )}

                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={addCondition}
          className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          <Plus size={14} />
          Add condition
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
