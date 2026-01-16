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
  onInsert: (insert: ColumnInsertPosition) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editFieldOpen, setEditFieldOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null); // ✅ Add ref for entire header

  return (
    <>
      <div
        ref={headerRef} // ✅ Attach ref to the container
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
            onClose={() => setMenuOpen(false)}
            onRename={() => setEditFieldOpen(true)}
            onInsert={onInsert}
          />
        )}
      </div>

      {editFieldOpen && (
        <EditFieldPopover
          column={column}
          tableId={tableId}
          anchorRef={headerRef} // ✅ Pass headerRef instead of buttonRef
          onClose={() => setEditFieldOpen(false)}
        />
      )}
    </>
  );
}
