"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";

export default function ColumnHeaderMenu({
  columnId,
  onClose,
  anchorRef,
  tableId,
}: {
  columnId: string;
  tableId: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const utils = api.useUtils();
  const deleteColumn = api.column.delete.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
      onClose();
    },
  });

  // Position menu based on the header button
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();

    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-48 rounded-lg border border-zinc-200 bg-white py-2 shadow-xl"
      style={{
        top: coords.top,
        left: coords.left,
      }}
    >
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100">
        <Pencil size={14} />
        Edit field
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        onClick={() => deleteColumn.mutate({ columnId })}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} />
        Delete field
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
