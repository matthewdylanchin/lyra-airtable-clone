"use client";

import { useState, useRef } from "react";
import ColumnHeaderMenu from "./ColumnHeaderMenu";
import EditFieldPopover from "./EditFieldPopover";
import { ChevronDown } from "lucide-react";

export default function ColumnHeader({
  column,
  tableId,
}: {
  column: { id: string; name: string; type: string };
  tableId: string;
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
            onRename={() => {
              setMenuOpen(false);
              setEditFieldOpen(true);
            }}
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
