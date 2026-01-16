"use client";

import { useState, useRef } from "react";
import ColumnHeaderMenu from "./ColumnHeaderMenu";
import { ChevronDown } from "lucide-react";

export default function ColumnHeader({
  column,
  tableId,
}: {
  column: { id: string; name: string };
  tableId: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="group flex w-full items-center justify-between px-2 py-1">
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
          anchorRef={buttonRef} // 👈 anchored to arrow
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
