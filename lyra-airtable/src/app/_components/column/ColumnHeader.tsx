"use client";

import { useState, useRef } from "react";
import ColumnHeaderMenu from "./ColumnHeaderMenu";
import EditFieldPopover from "./EditFieldPopover";
import { ChevronDown } from "lucide-react";
import type { ColumnInsertPosition } from "@/app/base/[baseId]/table/[tableId]/types";

export default function ColumnHeader({
  column,
  tableId,
  onInsert,
}: {
  column: { id: string; name: string; type: string };
  tableId: string;
  onInsert: (
    insert: ColumnInsertPosition,
    position: { top: number; left: number },
  ) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editFieldOpen, setEditFieldOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={headerRef}
        className="group flex w-full items-center justify-between px-2 py-1"
        onDoubleClick={() => {
          setMenuOpen(false);
          setEditFieldOpen(true);
        }}
      >
        <span className="truncate text-sm">{column.name}</span>

        <button
          ref={buttonRef}
          onClick={() => setMenuOpen(true)}
          className="invisible flex-shrink-0 text-xs text-zinc-500 group-hover:visible hover:text-zinc-800"
        >
          <ChevronDown size={14} />
        </button>

        {menuOpen && (
          <ColumnHeaderMenu
            columnId={column.id}
            tableId={tableId}
            anchorRef={buttonRef}
            columnHeaderRef={headerRef}
            onClose={() => setMenuOpen(false)}
            onRename={() => setEditFieldOpen(true)}
            onInsert={(insert) => {
              // Capture chevron position before anything else
              if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const position = {
                  top: rect.bottom + 8,
                  left: rect.left,
                };
                onInsert(insert, position);
              }
            }}
          />
        )}
      </div>

      {editFieldOpen && (
        <EditFieldPopover
          column={column}
          tableId={tableId}
          anchorRef={headerRef}
          onClose={() => setEditFieldOpen(false)}
        />
      )}
    </>
  );
}
