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
import { useQueryClient } from "@tanstack/react-query";

type ColumnHeaderMenuProps = {
  columnId: string;
  tableId: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  columnHeaderRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onRename: () => void;
  onInsert: (insert: ColumnInsertPosition) => void;
};

type TablePage = {
  columns: { id: string }[];
  cells: { columnId: string }[];
};

type TableQueryData = {
  pageParams: unknown[];
  pages: TablePage[];
};

export default function ColumnHeaderMenu({
  columnId,
  tableId,
  anchorRef,
  columnHeaderRef: _columnHeaderRef, // ✅ Prefix with _ to mark as intentionally unused
  onClose,
  onRename,
  onInsert,
}: ColumnHeaderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const insertLeftRef = useRef<HTMLButtonElement>(null);
  const insertRightRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const utils = api.useUtils();
  const queryClient = useQueryClient();

  const deleteColumn = api.column.delete.useMutation({
    onMutate: async ({ columnId }) => {
      // Cancel all outgoing refetches for this table
      await utils.table.getData.cancel({ tableId });

      // Find ALL queries that match this table
      const allQueries = queryClient.getQueryCache().findAll({
        predicate: (query) => {
          const key = query.queryKey;

          // Type guard to check if this is a valid table query key
          if (!Array.isArray(key) || key.length !== 2) {
            return false;
          }

          // ✅ Access array elements directly and type-guard them
          const path: unknown = key[0];
          const params: unknown = key[1];

          // Check if path matches ["table", "getData"]
          if (
            !Array.isArray(path) ||
            path.length !== 2 ||
            path[0] !== "table" ||
            path[1] !== "getData"
          ) {
            return false;
          }

          // Type guard for params object
          if (
            typeof params !== "object" ||
            params === null ||
            !("input" in params)
          ) {
            return false;
          }

          // Now we can safely access input
          const input = (params as { input: unknown }).input;

          // Check if input has tableId
          if (
            typeof input !== "object" ||
            input === null ||
            !("tableId" in input)
          ) {
            return false;
          }

          // Final check for tableId match
          return (input as { tableId: string }).tableId === tableId;
        },
      });

      console.log(`🔄 Updating ${allQueries.length} queries`);

      // Update each query's data optimistically
      allQueries.forEach((query) => {
        const data = query.state.data as TableQueryData | undefined;
        if (!data) return;

        queryClient.setQueryData(query.queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            columns: page.columns.filter((c) => c.id !== columnId),
            cells: page.cells.filter((c) => c.columnId !== columnId),
          })),
        });
      });

      return {};
    },

    onError: (err) => {
      console.error("❌ Delete failed:", err);
      // Refetch on error to restore correct state
      void utils.table.getData.invalidate({ tableId });
    },

    onSuccess: () => {
      console.log("✅ Column deleted successfully");
      // Don't invalidate - trust the optimistic update
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
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
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
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
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
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <ArrowRight size={16} />
        Insert right
      </button>

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Focus size={16} />
        Change primary field
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Link2 size={16} />
        Copy field URL
      </button>

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Info size={16} />
        Edit field description
      </button>

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Lock size={16} />
        Edit field permissions
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <ArrowDownAZ size={16} />
        Sort A → Z
      </button>

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <ArrowUpAZ size={16} />
        Sort Z → A
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Filter size={16} />
        Filter by this field
      </button>

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <Grid2X2 size={16} />
        Group by this field
      </button>

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <GitBranch size={16} />
        Show dependencies
      </button>

      <div className="my-1 border-t border-zinc-200" />

      <button
        disabled
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-100"
      >
        <EyeOff size={16} />
        Hide field
      </button>

      <button
        disabled={deleteColumn.isPending}
        onClick={() => void deleteColumn.mutate({ columnId })}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 size={16} />
        Delete field
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
