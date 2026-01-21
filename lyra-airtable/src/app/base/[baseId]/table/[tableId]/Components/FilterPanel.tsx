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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position - align to RIGHT of button
  useEffect(() => {
    if (!isOpen || !triggerRef?.current) return;

    const updatePosition = () => {
      const buttonRect = triggerRef.current?.getBoundingClientRect();
      if (buttonRect) {
        setPosition({
          top: buttonRect.bottom + 8,
          left: buttonRect.right - 680, // ✅ Panel width 680px - aligns right edge to button
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

  // Click outside to close
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
    value: string,
  ) => {
    onChange(filters.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  };

  const getOperatorsForColumn = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return column?.type === "NUMBER" ? NUMBER_OPERATORS : TEXT_OPERATORS;
  };

  const needsValueInput = (operator: string) => {
    return !["empty", "not_empty"].includes(operator);
  };

  if (!isOpen || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[680px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Filter</h3>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-zinc-100"
          aria-label="Close"
        >
          <X size={16} className="text-zinc-500" />
        </button>
      </div>

      {/* AI Prompt */}
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 hover:border-zinc-400">
          <Sparkles size={16} className="text-purple-500" />
          <input
            type="text"
            placeholder="Describe what you want to see"
            className="flex-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none"
          />
        </div>
      </div>

      {/* Conditions */}
      <div className="px-4 py-3">
        <div className="mb-3 text-xs font-medium text-zinc-600">
          In this view, show records
        </div>

        {/* Condition Group Header */}
        <div className="mb-2 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <span className="text-sm font-medium text-zinc-700">Where</span>
          <select
            value={conjunctionMode}
            onChange={(e) =>
              onConjunctionModeChange?.(e.target.value as "and" | "or")
            }
            className="rounded border-none bg-transparent px-1 py-0 text-sm text-zinc-600 outline-none hover:bg-zinc-100"
          >
            <option value="and">All</option>
            <option value="or">Any</option>
          </select>
          <span className="text-sm text-zinc-600">
            of the following are true...
          </span>
          <div className="ml-auto flex gap-1">
            <button className="rounded p-1 hover:bg-zinc-200">
              <Plus size={14} className="text-zinc-600" />
            </button>
            <button className="rounded p-1 hover:bg-zinc-200">
              <Trash2 size={14} className="text-zinc-600" />
            </button>
            <button className="rounded p-1 hover:bg-zinc-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Conditions */}
        <div className="space-y-2">
          {filters.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">No filters applied</p>
            </div>
          ) : (
            filters.map((condition, index) => {
              const operators = getOperatorsForColumn(condition.columnId);
              const showValueInput = needsValueInput(condition.operator);

              return (
                <div
                  key={condition.id}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
                >
                  {/* ✅ AND/OR Label (only show after first condition) */}
                  {index > 0 && (
                    <span className="text-xs font-medium text-zinc-700">
                      {conjunctionMode === "and" ? "And" : "Or"}
                    </span>
                  )}

                  {/* ✅ Show "Where" only for first condition */}
                  {index === 0 && (
                    <span className="text-xs text-zinc-600">Where</span>
                  )}

                  {/* Column Select */}
                  <select
                    value={condition.columnId}
                    onChange={(e) =>
                      updateCondition(condition.id, "columnId", e.target.value)
                    }
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none hover:border-zinc-400"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(condition.id, "operator", e.target.value)
                    }
                    className="rounded border-none bg-transparent px-2 py-1 text-sm text-zinc-600 outline-none"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {/* Value Input */}
                  {showValueInput && (
                    <input
                      type="text"
                      value={condition.value ?? ""}
                      onChange={(e) =>
                        updateCondition(condition.id, "value", e.target.value)
                      }
                      placeholder="Enter a value"
                      className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm outline-none hover:border-zinc-400"
                    />
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="rounded p-1 hover:bg-zinc-100"
                  >
                    <Trash2 size={14} className="text-zinc-500" />
                  </button>

                  {/* Drag Handle */}
                  <button className="cursor-grab rounded p-1 hover:bg-zinc-100">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add Condition Buttons */}
        <div className="mt-3 flex gap-3 text-sm">
          <button
            onClick={addCondition}
            className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900"
          >
            <Plus size={14} />
            Add condition
          </button>
          <button className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900">
            <Plus size={14} />
            Add condition group
          </button>
          <button className="ml-auto flex items-center gap-1 text-zinc-400 hover:text-zinc-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 16v-4M12 8h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
