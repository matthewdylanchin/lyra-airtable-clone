"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { EyeOff, Search } from "lucide-react";
import { useTableView } from "@/app/base/[baseId]/table/[tableId]/TableViewContext";
import type { Column } from "@/app/base/[baseId]/table/[tableId]/types";

type HideFieldsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  triggerRef?: React.RefObject<HTMLElement | null>;
};

export default function HideFieldsPanel({
  isOpen,
  onClose,
  columns,
  triggerRef,
}: HideFieldsPanelProps) {
  const { hiddenColumnIds, setHiddenColumnIds } = useTableView();
  const [searchQuery, setSearchQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef?.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  // Filter columns by search query
  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleColumn = (columnId: string) => {
    if (hiddenColumnIds.includes(columnId)) {
      setHiddenColumnIds(hiddenColumnIds.filter((id) => id !== columnId));
    } else {
      setHiddenColumnIds([...hiddenColumnIds, columnId]);
    }
  };

  const hideAll = () => {
    setHiddenColumnIds(columns.map((col) => col.id));
  };

  const showAll = () => {
    setHiddenColumnIds([]);
  };

  // Calculate position
  const getPosition = () => {
    if (!triggerRef?.current) {
      return { top: 100, left: 100 };
    }

    const rect = triggerRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      left: rect.left,
    };
  };

  const position = getPosition();

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-50 w-[280px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header with search */}
      <div className="border-b border-zinc-200 p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Find a field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-zinc-300 py-1.5 pr-3 pl-8 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        </div>
      </div>

      {/* Column list */}
      <div className="max-h-[400px] overflow-y-auto p-2">
        {filteredColumns.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">
            No fields found
          </div>
        ) : (
          filteredColumns.map((column) => {
            const isHidden = hiddenColumnIds.includes(column.id);

            return (
              <button
                key={column.id}
                onClick={() => toggleColumn(column.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-zinc-50"
              >
                {/* Toggle switch */}
                <div
                  className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                    isHidden ? "bg-zinc-200" : "bg-emerald-500"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      isHidden ? "left-0.5" : "left-4"
                    }`}
                  />
                </div>

                {/* Column icon and name */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700">A</span>
                  <span className="text-sm text-zinc-700">{column.name}</span>
                </div>

                {/* Drag handle */}
                <div className="ml-auto flex flex-col gap-0.5">
                  <div className="h-0.5 w-1 rounded-full bg-zinc-400" />
                  <div className="h-0.5 w-1 rounded-full bg-zinc-400" />
                  <div className="h-0.5 w-1 rounded-full bg-zinc-400" />
                  <div className="h-0.5 w-1 rounded-full bg-zinc-400" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2">
        <button
          onClick={hideAll}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          Hide all
        </button>
        <button
          onClick={showAll}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          Show all
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
