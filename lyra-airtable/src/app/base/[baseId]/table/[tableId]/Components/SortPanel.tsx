"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Column {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER";
}

interface SortCondition {
  id: string;
  columnId: string;
  direction: "asc" | "desc";
}

interface SortPanelProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  sorts: SortCondition[];
  onChange: (sorts: SortCondition[]) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function SortPanel({
  isOpen,
  onClose,
  columns,
  sorts,
  onChange,
  triggerRef,
}: SortPanelProps) {
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
          left: buttonRect.right - 480, // Panel width 480px
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

  const addSort = () => {
    onChange([
      ...sorts,
      {
        id: uuidv4(),
        columnId: columns[0]?.id ?? "",
        direction: "asc",
      },
    ]);
  };

  const removeSort = (id: string) => {
    onChange(sorts.filter((s) => s.id !== id));
  };

  const updateSort = (
    id: string,
    key: keyof SortCondition,
    value: string,
  ) => {
    onChange(sorts.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  };

  const clearAll = () => {
    onChange([]);
  };

  if (!isOpen || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[480px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Sort</h3>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-zinc-100"
          aria-label="Close"
        >
          <X size={16} className="text-zinc-500" />
        </button>
      </div>

      {/* Sorts */}
      <div className="px-4 py-3">
        {sorts.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center">
            <p className="text-sm text-zinc-500">No sorts applied</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorts.map((sort, index) => (
              <div
                key={sort.id}
                className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
              >
                {/* Priority Number */}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
                  {index + 1}
                </span>

                {/* Column Select */}
                <select
                  value={sort.columnId}
                  onChange={(e) =>
                    updateSort(sort.id, "columnId", e.target.value)
                  }
                  className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none hover:border-zinc-400"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>

                {/* Direction Buttons */}
                <div className="flex rounded border border-zinc-300">
                  <button
                    onClick={() => updateSort(sort.id, "direction", "asc")}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${
                      sort.direction === "asc"
                        ? "bg-blue-50 text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <ArrowUp size={12} />
                    Asc
                  </button>
                  <div className="w-px bg-zinc-300" />
                  <button
                    onClick={() => updateSort(sort.id, "direction", "desc")}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${
                      sort.direction === "desc"
                        ? "bg-blue-50 text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <ArrowDown size={12} />
                    Desc
                  </button>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => removeSort(sort.id)}
                  className="rounded p-1 hover:bg-zinc-100"
                >
                  <Trash2 size={14} className="text-zinc-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={addSort}
            className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
          >
            <Plus size={14} />
            Add sort
          </button>

          {sorts.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Info */}
        {sorts.length > 1 && (
          <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Rows are sorted by priority: 1 → {sorts.length}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}