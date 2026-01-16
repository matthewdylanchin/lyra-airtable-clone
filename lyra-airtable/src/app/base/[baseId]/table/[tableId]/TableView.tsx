"use client";

import { useEffect, useRef, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import type { Table } from "@tanstack/react-table";
import type { TableRow, AddColumnState } from "./types";
import AddColumnButton from "./Components/AddColumnButton";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

type RowContextMenuState = {
  rowId: string;
  rowIndex: number;
  x: number;
  y: number;
} | null;

export function TableView({
  table,
  addColumnOpen,
  onCloseAddColumn,
}: {
  table: Table<TableRow>;
  addColumnOpen: AddColumnState;
  onCloseAddColumn: () => void;
}) {
  const { tableId } = useParams<{ tableId: string }>();

  const utils = api.useUtils();

  /* ---------- Row mutations ---------- */

  // Append at bottom (used by "+ Add row")
  const appendRow = api.row.create.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
    },
  });

  // Insert above / below
  const insertRow = api.row.insertAtPosition.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
      setRowMenu(null);
    },
  });

  // Delete row
  const deleteRow = api.row.delete.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
      setRowMenu(null);
    },
  });

  /* ---------- Right-click context menu state ---------- */

  const [rowMenu, setRowMenu] = useState<RowContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close context menu on outside click / ESC
  useEffect(() => {
    if (!rowMenu) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setRowMenu(null);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRowMenu(null);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [rowMenu]);

  /* ---------- Handlers ---------- */

  const handleInsert = (position: "above" | "below") => {
    if (!rowMenu) return;

    insertRow.mutate({
      tableId,
      anchorRowId: rowMenu.rowId,
      position,
    });
  };

  const handleDelete = () => {
    if (!rowMenu) return;

    deleteRow.mutate(rowMenu.rowId);
  };
  const handleAddRow = () => {
    appendRow.mutate({ tableId });
  };

  const visibleColumnCount = table.getVisibleLeafColumns().length + 1; // +1 for the add-column header

  /* ---------- Render ---------- */

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-zinc-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="border-b px-2 py-2 text-left font-medium whitespace-nowrap"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}

              <th className="border-b px-2 py-2 text-left font-medium">
                <AddColumnButton tableId={tableId} />
              </th>
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => {
            const rowId = row.original.__rowId;

            return (
              <tr key={row.id} className="border-b">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-1"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setRowMenu({
                        rowId,
                        rowIndex: row.index,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Airtable-style "+ Add row" bar */}
          <tr className="border-t">
            <td
              colSpan={visibleColumnCount}
              className="bg-zinc-50 px-3 py-2 text-left text-sm"
            >
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
              >
                <span className="text-lg leading-none">+</span>
                <span>Add row</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Right-click row context menu */}
      {rowMenu && (
        <div
          ref={menuRef}
          className="fixed z-[10000] w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
          style={{ top: rowMenu.y, left: rowMenu.x }}
        >
          <button
            type="button"
            onClick={() => handleInsert("above")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
          >
            ↑ Insert record above
          </button>
          <button
            type="button"
            onClick={() => handleInsert("below")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
          >
            ↓ Insert record below
          </button>

          <div className="my-1 border-t border-zinc-200" />

          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete record
          </button>
        </div>
      )}

      {/* existing column-insert overlay */}
      {addColumnOpen && (
        <AddColumnButton
          tableId={tableId}
          insert={addColumnOpen.insert}
          onClose={onCloseAddColumn}
          autoOpen
          initialPosition={addColumnOpen.position}
        />
      )}
    </>
  );
}
