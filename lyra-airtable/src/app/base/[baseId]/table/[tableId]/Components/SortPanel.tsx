"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import CustomDropdown from "./CustomDropdown";

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

  // Position panel below button
  useEffect(() => {
    if (!isOpen || !triggerRef?.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, triggerRef]);

  const addSort = () => {
    const newSorts = [
      ...sorts,
      {
        id: uuidv4(),
        columnId: columns[0]?.id ?? "",
        direction: "asc" as const,
      },
    ];

    // Apply immediately
    onChange(newSorts);
  };

  const updateSort = (id: string, key: keyof SortCondition, value: string) => {
    const newSorts = sorts.map((s) =>
      s.id === id ? { ...s, [key]: value } : s,
    );

    // Apply immediately
    onChange(newSorts);
  };

  const removeSort = (id: string) => {
    const newSorts = sorts.filter((s) => s.id !== id);

    // Apply immediately
    onChange(newSorts);
  };

  // Quick sort - click column to sort immediately
  const handleQuickSort = (columnId: string) => {
    const newSort = {
      id: uuidv4(),
      columnId,
      direction: "asc" as const,
    };

    // Apply immediately
    onChange([newSort]);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[380px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-900">Sort by</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100">
          <X size={16} className="text-zinc-500" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-2 px-4 py-3">
        {sorts.length === 0 ? (
          <div className="space-y-1">
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => handleQuickSort(col.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50"
              >
                <span className="text-zinc-400">
                  {col.type === "TEXT" ? "A" : "#"}
                </span>
                <span className="text-zinc-700">{col.name}</span>
              </button>
            ))}
          </div>
        ) : (
          sorts.map((sort) => {
            const column = columns.find((c) => c.id === sort.columnId);
            const isText = column?.type === "TEXT";

            return (
              <div key={sort.id} className="flex items-center gap-2">
                {/* Column dropdown */}
                <CustomDropdown
                  value={sort.columnId}
                  options={columns.map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: (
                      <span className="text-zinc-400">
                        {c.type === "TEXT" ? "A" : "#"}
                      </span>
                    ),
                  }))}
                  onChange={(v) => updateSort(sort.id, "columnId", v)}
                  className="flex-1"
                />

                {/* Direction dropdown */}
                <CustomDropdown
                  value={sort.direction}
                  options={
                    isText
                      ? [
                          { value: "asc", label: "A → Z" },
                          { value: "desc", label: "Z → A" },
                        ]
                      : [
                          { value: "asc", label: "1 → 9" },
                          { value: "desc", label: "9 → 1" },
                        ]
                  }
                  onChange={(v) =>
                    updateSort(sort.id, "direction", v as "asc" | "desc")
                  }
                />

                <button
                  onClick={() => removeSort(sort.id)}
                  className="rounded p-1.5 hover:bg-zinc-100"
                >
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
            );
          })
        )}

        {sorts.length > 0 && (
          <button
            onClick={addSort}
            className="mt-2 flex w-full items-center gap-1.5 rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <Plus size={14} />
            Add another sort
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
