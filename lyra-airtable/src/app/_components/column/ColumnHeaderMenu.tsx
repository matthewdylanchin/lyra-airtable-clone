"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";

type ColumnHeaderMenuProps = {
  columnId: string;
  tableId: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onRename: () => void;
};

export default function ColumnHeaderMenu({
  columnId,
  tableId,
  anchorRef,
  onClose,
  onRename,
}: ColumnHeaderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const utils = api.useUtils();
  const deleteColumn = api.column.delete.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
      onClose();
    },
  });

  // Position menu under chevron (centered)
  useEffect(() => {
    if (!anchorRef.current || !menuRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    const GAP = 6;

    const top = rect.bottom + GAP;
    const left = rect.left + rect.width / 2 - menuRect.width / 2;

    setCoords({ top, left });
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
  }, [onClose, anchorRef]);

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-48 rounded-lg border border-zinc-200 bg-white py-2 shadow-xl"
      style={{
        top: coords.top,
        left: coords.left,
      }}
    >
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100"
      >
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
