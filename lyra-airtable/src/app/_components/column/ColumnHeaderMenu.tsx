"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  Trash2,
  Copy,
  ArrowLeft,
  ArrowRight,
  Focus,
  Link2,
  Info,
  Lock,
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
  Grid2X2,
  GitBranch,
  EyeOff,
} from "lucide-react";
import { api } from "@/trpc/react";
import type { ColumnInsertPosition } from "@/app/base/[baseId]/table/[tableId]/types";

type ColumnHeaderMenuProps = {
  columnId: string;
  tableId: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  columnHeaderRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onRename: () => void;
  onInsert: (insert: ColumnInsertPosition) => void;
};

export default function ColumnHeaderMenu({
  columnId,
  tableId,
  anchorRef,
  columnHeaderRef,
  onClose,
  onRename,
  onInsert,
}: ColumnHeaderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const insertLeftRef = useRef<HTMLButtonElement>(null);
  const insertRightRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const utils = api.useUtils();
  const deleteColumn = api.column.delete.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
      onClose();
    },
  });

  useEffect(() => {
    if (!anchorRef.current || !menuRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    const GAP = 6;

    const top = rect.bottom + GAP;
    const left = rect.left + rect.width / 2 - menuRect.width / 2;

    setCoords({ top, left });
  }, [anchorRef]);

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
      className="fixed z-[9999] w-75 rounded-lg border border-zinc-200 bg-white py-2 shadow-xl"
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
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Pencil size={16} />
        Edit field
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Copy size={16} />
        Duplicate field
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        ref={insertLeftRef}
        type="button"
        onClick={() => {
          console.log("Insert left clicked, columnId:", columnId);
          onInsert({ type: "before", columnId });
          onClose();
        }}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <ArrowLeft size={16} />
        Insert left
      </button>

      <button
        ref={insertRightRef}
        type="button"
        onClick={() => {
          console.log("Insert right clicked, columnId:", columnId);
          onInsert({ type: "after", columnId });
          onClose();
        }}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <ArrowRight size={16} />
        Insert right
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Focus size={16} />
        Change primary field
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Link2 size={16} />
        Copy field URL
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Info size={16} />
        Edit field description
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Lock size={16} />
        Edit field permissions
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <ArrowDownAZ size={16} />
        Sort A → Z
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <ArrowUpAZ size={16} />
        Sort Z → A
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Filter size={16} />
        Filter by this field
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <Grid2X2 size={16} />
        Group by this field
      </button>

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <GitBranch size={16} />
        Show dependencies
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2 text-left text-sm text-zinc-400"
      >
        <EyeOff size={16} />
        Hide field
      </button>

      <button
        onClick={() => deleteColumn.mutate({ columnId })}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 size={16} />
        Delete field
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
