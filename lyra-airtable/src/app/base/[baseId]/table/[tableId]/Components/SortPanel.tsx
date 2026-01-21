"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";
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

  // Calculate position - align below button
  useEffect(() => {
    if (!isOpen) {
      console.log("Panel not open");
      return;
    }

    if (!triggerRef) {
      console.log("No triggerRef provided");
      return;
    }

    if (!triggerRef.current) {
      console.log("triggerRef.current is null");
      return;
    }

    const updatePosition = () => {
      const button = triggerRef.current;
      if (!button) {
        console.log("Button element not found");
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      console.log("Button position:", buttonRect);
      setPosition({
        top: buttonRect.bottom + 8,
        left: buttonRect.left,
      });
    };

    // Use a small delay to ensure the ref is ready
    const timer = setTimeout(updatePosition, 10);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
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

  const updateSort = (id: string, key: keyof SortCondition, value: string) => {
    onChange(sorts.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  };

  if (!isOpen || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[320px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-900">Sort by</h3>
          <button className="rounded-full p-0.5 hover:bg-zinc-100">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-zinc-400"
            >
              <circle
                cx="7"
                cy="7"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <text
                x="7"
                y="10"
                fontSize="9"
                textAnchor="middle"
                fill="currentColor"
                fontWeight="600"
              >
                ?
              </text>
            </svg>
          </button>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-zinc-100"
          aria-label="Close"
        >
          <X size={16} className="text-zinc-500" />
        </button>
      </div>

      {/* Sorts */}
      <div className="px-3 py-3">
        {sorts.length === 0 ? (
          <>
            {/* Search Input */}
            <div className="relative mb-2">
              <svg
                className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M9 9L12 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="text"
                placeholder="Find a field"
                className="w-full rounded border border-zinc-300 bg-white py-1.5 pr-3 pl-9 text-sm outline-none placeholder:text-zinc-400 hover:border-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Column List */}
            <div className="max-h-[300px] overflow-y-auto">
              {columns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => {
                    onChange([
                      {
                        id: uuidv4(),
                        columnId: col.id,
                        direction: "asc",
                      },
                    ]);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="text-zinc-400">
                    {col.type === "TEXT" ? "A" : "#"}
                  </span>
                  <span className="text-zinc-700">{col.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {sorts.map((sort) => {
              const column = columns.find((c) => c.id === sort.columnId);
              const isText = column?.type === "TEXT";

              return (
                <div key={sort.id} className="flex items-center gap-2">
                  {/* Column Select */}
                  <select
                    value={sort.columnId}
                    onChange={(e) =>
                      updateSort(sort.id, "columnId", e.target.value)
                    }
                    className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none hover:border-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>

                  {/* Direction Select */}
                  <select
                    value={sort.direction}
                    onChange={(e) =>
                      updateSort(
                        sort.id,
                        "direction",
                        e.target.value as "asc" | "desc",
                      )
                    }
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none hover:border-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {isText ? (
                      <>
                        <option value="asc">A → Z</option>
                        <option value="desc">Z → A</option>
                      </>
                    ) : (
                      <>
                        <option value="asc">1 → 9</option>
                        <option value="desc">9 → 1</option>
                      </>
                    )}
                  </select>

                  {/* Delete Button */}
                  <button
                    onClick={() => removeSort(sort.id)}
                    className="rounded p-1.5 hover:bg-zinc-100"
                  >
                    <X size={14} className="text-zinc-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Sort Button - only show when sorts exist */}
        {sorts.length > 0 && (
          <button
            onClick={addSort}
            className="mt-2 flex w-full items-center gap-1.5 rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <Plus size={14} />
            Add another sort
          </button>
        )}

        {/* Automatically sort records */}
        {sorts.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4L3.5 6.5L9 1"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-emerald-700">
              Automatically sort records
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
