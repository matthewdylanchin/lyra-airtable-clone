"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useCellEditing, useEditingContext } from "./EditingContext";

type EditableCellProps = {
  rowId: string;
  columnId: string;
  value: string | number | null;
  rowIndex: number;
  colIndex: number;
  isSelected: boolean;
  isNumberCol: boolean;
  isFilteredColumn: boolean;
  isSortedColumn: boolean;
  isMatch: boolean;
  isCurrentMatch: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
};

export const EditableCell = memo(function EditableCell({
  rowId,
  columnId,
  value,
  rowIndex,
  colIndex,
  isSelected,
  isNumberCol,
  isFilteredColumn,
  isSortedColumn,
  isMatch,
  isCurrentMatch,
  onSelect,
  onStartEdit,
}: EditableCellProps) {
  const { isEditing, draft, setDraft, commitEdit, cancelEdit } = useCellEditing(rowId, columnId);

  return (
    <div
      className={cn(
        "relative flex h-9 w-full cursor-default items-center outline-none",
        isSelected && "ring-2 ring-blue-600 ring-inset",
        !isEditing && "hover:bg-zinc-50",
        isFilteredColumn && "bg-emerald-50",
        isSortedColumn && !isFilteredColumn && "bg-orange-50",
        isCurrentMatch && "border-l-2 border-amber-200 bg-amber-200",
        isMatch && !isCurrentMatch && "border-l-2 border-amber-100 bg-amber-100",
      )}
      onClick={onSelect}
      onDoubleClick={onStartEdit}
    >
      {isEditing ? (
        <input
          key={`edit-${rowIndex}-${columnId}`}
          autoFocus
          value={draft}
          onChange={(e) => {
            const val = e.target.value;
            if (isNumberCol) {
              if (/^-?\d*\.?\d*$/.test(val)) {
                setDraft(val);
              }
              return;
            }
            setDraft(val);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              commitEdit();
              return;
            }
            if (e.key === "Tab") {
              e.preventDefault();
              commitEdit();
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
              return;
            }
          }}
          onBlur={() => commitEdit()}
          className="absolute inset-0 h-full w-full border-none bg-transparent px-2.5 text-sm outline-none focus:ring-0 focus:outline-none"
          style={{ boxShadow: "none" }}
        />
      ) : (
        <span className="block truncate px-2.5 text-sm">
          {String(value ?? "")}
        </span>
      )}
    </div>
  );
});