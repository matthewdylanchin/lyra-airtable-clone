"use client";

import { useState, useRef } from "react";
import ColumnHeaderMenu from "./ColumnHeaderMenu";
import EditFieldPopover from "./EditFieldPopover";
import { ChevronDown, CaseSensitive, Hash, ALargeSmall } from "lucide-react";
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

  // Get the appropriate icon based on column type
  const Icon = column.type === "NUMBER" ? Hash : ALargeSmall;

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
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Icon className="h-4 w-4 flex-shrink-0 text-zinc-700" />
          <span className="truncate text-sm text-zinc-800">{column.name}</span>
        </div>

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
