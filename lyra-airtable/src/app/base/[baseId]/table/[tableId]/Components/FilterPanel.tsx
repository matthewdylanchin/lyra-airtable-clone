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
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  const addCondition = () => {
    onChange([
      ...filters,
      {
        id: uuidv4(),
        columnId: columns[0]?.id ?? "",
        operator: "contains",
        value: "",
      },
    ]);
  };

  const removeCondition = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  const updateCondition = (
    id: string,
    key: keyof FilterCondition,
    value: string | undefined,
  ) => {
    onChange(filters.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
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
          onClick={onClose}
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
          {filters.length === 0 ? (
            <div className="rounded-md py-8 text-center">
              <div className="mb-1 text-sm text-zinc-500">
                No filter conditions are applied
              </div>
            </div>
          ) : (
            filters.map((condition, index) => {
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
                      value={conjunctionMode}
                      options={[
                        { value: "and", label: "and" },
                        { value: "or", label: "or" },
                      ]}
                      onChange={(v) =>
                        onConjunctionModeChange?.(v as "and" | "or")
                      }
                      className="w-[52px]"
                    />
                  ) : (
                    <span className="w-[52px] text-xs font-medium text-zinc-700">
                      {conjunctionMode === "and" ? "And" : "Or"}
                    </span>
                  )}

                  <CustomDropdown
                    value={condition.columnId}
                    options={columns.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    onChange={(v) =>
                      updateCondition(condition.id, "columnId", v)
                    }
                    className="w-[120px]"
                  />

                  <CustomDropdown
                    value={condition.operator}
                    options={operators}
                    onChange={(v) =>
                      updateCondition(condition.id, "operator", v)
                    }
                    className="w-[120px]"
                  />

                  {needsValueInput(condition.operator) && (
                    <input
                      value={condition.value ?? ""}
                      onChange={(e) =>
                        updateCondition(condition.id, "value", e.target.value)
                      }
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

// Demo component to show the filter panel in action
function Demo() {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState<FilterCondition[]>([
    { id: "1", columnId: "name", operator: "contains", value: "" },
    { id: "2", columnId: "name", operator: "contains", value: "" },
    { id: "3", columnId: "name", operator: "contains", value: "" },
  ]);
  const [conjunctionMode, setConjunctionMode] = useState<"and" | "or">("and");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const columns: Column[] = [
    { id: "name", name: "Name", type: "TEXT" },
    { id: "status", name: "Status", type: "TEXT" },
    { id: "assignee", name: "Assignee", type: "TEXT" },
    { id: "priority", name: "Priority", type: "TEXT" },
    { id: "count", name: "Count", type: "NUMBER" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex justify-end">
          <button
            ref={triggerRef}
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50"
          >
            Toggle Filter Panel
          </button>
        </div>

        <FilterPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          columns={columns}
          filters={filters}
          onChange={setFilters}
          triggerRef={triggerRef}
          conjunctionMode={conjunctionMode}
          onConjunctionModeChange={setConjunctionMode}
        />

        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Current Filters</h2>
          <pre className="overflow-auto rounded bg-zinc-50 p-4 text-xs">
            {JSON.stringify({ filters, conjunctionMode }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
