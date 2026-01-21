"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Sparkles } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { FilterCondition } from "../types";
import CustomDropdown from "./CustomDropdown";

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
    value: string,
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
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Filter</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100">
          <X size={16} />
        </button>
      </div>

      {/* AI Prompt */}
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2">
          <Sparkles size={16} className="text-purple-500" />
          <input
            className="flex-1 text-sm outline-none"
            placeholder="Describe what you want to see"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3">
        <div className="mb-3 text-xs font-medium text-zinc-600">
          In this view, show records
        </div>

        <div className="space-y-2">
          {filters.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-zinc-500">
              No filters applied
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
                <div
                  key={condition.id}
                  className="flex items-center gap-2 rounded-md border-zinc-200 px-3 py-2"
                >
                  {index === 0 ? (
                    <span className="text-xs font-medium">Where</span>
                  ) : index === 1 ? (
                    <CustomDropdown
                      value={conjunctionMode}
                      options={[
                        { value: "and", label: "And" },
                        { value: "or", label: "Or" },
                      ]}
                      onChange={(v) =>
                        onConjunctionModeChange?.(v as "and" | "or")
                      }
                      className="w-[80px]"
                    />
                  ) : (
                    <span className="text-xs font-medium">
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
                    className="w-[160px]"
                  />

                  <CustomDropdown
                    value={condition.operator}
                    options={operators}
                    onChange={(v) =>
                      updateCondition(condition.id, "operator", v)
                    }
                    className="w-[140px]"
                  />

                  {needsValueInput(condition.operator) && (
                    <input
                      value={condition.value ?? ""}
                      onChange={(e) =>
                        updateCondition(condition.id, "value", e.target.value)
                      }
                      className="flex-1 rounded border border-zinc-200 px-2 py-1 text-sm"
                      placeholder="Enter a value"
                    />
                  )}

                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="rounded p-1 hover:bg-zinc-100"
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
          className="mt-3 flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
        >
          <Plus size={14} />
          Add condition
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
