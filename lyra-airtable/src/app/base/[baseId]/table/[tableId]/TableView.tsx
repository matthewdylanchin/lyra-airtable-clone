"use client";

import { useEffect, useRef, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import type { Table } from "@tanstack/react-table";
import type { TableRow, AddColumnState } from "./types";
import AddColumnButton from "./Components/AddColumnButton";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { useVirtualizer } from "@tanstack/react-virtual";

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
  focusedRowIndex,
  focusedColumnIndex,
}: {
  table: Table<TableRow>;
  addColumnOpen: AddColumnState;
  onCloseAddColumn: () => void;
  focusedRowIndex?: number | null;
  focusedColumnIndex?: number | null;
}) {
  const { tableId } = useParams<{ tableId: string }>();
  const utils = api.useUtils();

  /* ---------- Row mutations ---------- */

  // Append at bottom (used by "+ Add row")
  const appendRow = api.row.create.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
    },
  });

  // Insert above / below
  const insertRow = api.row.insertAtPosition.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
      setRowMenu(null);
    },
  });

  // Delete row
  const deleteRow = api.row.delete.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
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

    void insertRow.mutate({
      tableId,
      anchorRowId: rowMenu.rowId,
      position,
    });
  };

  const handleDelete = () => {
    if (!rowMenu) return;

    void deleteRow.mutate(rowMenu.rowId);
  };

  const handleAddRow = () => {
    void appendRow.mutate({ tableId });
  };

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const visibleColumns = table.getVisibleLeafColumns();

  /* ---------- Virtualization ---------- */

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLTableSectionElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  // Add 1 to count for the "Add row" button row
  const rowVirtualizer = useVirtualizer({
    count: rows.length + 1, // +1 for the add row button
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33, // estimated row height in px (Airtable-style)
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1]!.end
      : 0;

  /* ---------- Vertical scrolling (existing) ---------- */
  useEffect(() => {
    if (focusedRowIndex == null) return;
    if (focusedRowIndex < 0 || focusedRowIndex >= rows.length) return;

    const container = tableContainerRef.current;
    const header = headerRef.current;
    const focusedRowElement = rowRefs.current.get(focusedRowIndex);

    if (!container || !header || !focusedRowElement) {
      // Row not rendered yet, use virtualizer fallback
      rowVirtualizer.scrollToIndex(focusedRowIndex, { align: "auto" });
      return;
    }

    // Get the actual positions from the DOM
    const containerRect = container.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const rowRect = focusedRowElement.getBoundingClientRect();

    // Calculate visible area (excluding header)
    const visibleTop = containerRect.top + headerRect.height;
    const visibleBottom = containerRect.bottom;

    // Check if row is fully visible
    const isFullyVisible =
      rowRect.top >= visibleTop && rowRect.bottom <= visibleBottom;

    if (isFullyVisible) {
      return;
    }

    // Calculate how much to scroll
    const currentScrollTop = container.scrollTop;
    let newScrollTop = currentScrollTop;

    if (rowRect.top < visibleTop) {
      // Row is cut off at top - scroll up just enough to show it
      const difference = visibleTop - rowRect.top;
      newScrollTop = currentScrollTop - difference;
    } else if (rowRect.bottom > visibleBottom) {
      // Row is cut off at bottom - scroll down just enough to show it
      const difference = rowRect.bottom - visibleBottom;
      newScrollTop = currentScrollTop + difference;
    }

    container.scrollTop = newScrollTop;
  }, [focusedRowIndex, rows.length, rowVirtualizer]);

  /* ---------- Horizontal scrolling (NEW!) ---------- */
  useEffect(() => {
    if (focusedRowIndex == null || focusedColumnIndex == null) return;
    if (focusedRowIndex < 0 || focusedRowIndex >= rows.length) return;
    if (focusedColumnIndex < 0 || focusedColumnIndex >= visibleColumns.length)
      return;

    const container = tableContainerRef.current;
    const cellKey = `${focusedRowIndex}-${focusedColumnIndex}`;
    const focusedCellElement = cellRefs.current.get(cellKey);

    if (!container || !focusedCellElement) {
      return;
    }

    // Get the actual positions from the DOM
    const containerRect = container.getBoundingClientRect();
    const cellRect = focusedCellElement.getBoundingClientRect();

    // Calculate visible area (horizontal)
    const visibleLeft = containerRect.left;
    const visibleRight = containerRect.right;

    // Check if cell is fully visible horizontally
    const isFullyVisible =
      cellRect.left >= visibleLeft && cellRect.right <= visibleRight;

    console.log("Horizontal Scroll Check:", {
      focusedColumnIndex,
      cellLeft: cellRect.left,
      cellRight: cellRect.right,
      visibleLeft,
      visibleRight,
      isFullyVisible,
      cellWidth: cellRect.width,
    });

    if (isFullyVisible) {
      console.log("✅ Cell fully visible horizontally - no scroll");
      return;
    }

    // Calculate how much to scroll
    const currentScrollLeft = container.scrollLeft;
    let newScrollLeft = currentScrollLeft;

    if (cellRect.left < visibleLeft) {
      // Cell is cut off on left - scroll left to show it
      const difference = visibleLeft - cellRect.left;
      newScrollLeft = currentScrollLeft - difference;
      console.log("⬅️ Scrolling LEFT by", difference, "px to:", newScrollLeft);
    } else if (cellRect.right > visibleRight) {
      // Cell is cut off on right - scroll right to show it
      const difference = cellRect.right - visibleRight;
      newScrollLeft = currentScrollLeft + difference;
      console.log("➡️ Scrolling RIGHT by", difference, "px to:", newScrollLeft);
    }

    container.scrollLeft = newScrollLeft;
  }, [focusedRowIndex, focusedColumnIndex, rows.length, visibleColumns.length]);

  /* ---------- Render ---------- */

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      {/* Scrollable container for both header and body - with horizontal scroll */}
      <div ref={tableContainerRef} className="h-full overflow-auto">
        <table
          className="w-full border-collapse"
          style={{ minWidth: "max-content" }}
        >
          {/* Fixed header with sticky positioning */}
          <thead
            ref={headerRef}
            className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50"
          >
            {headerGroups.map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const columnDef = header.column.columnDef;
                  const width = columnDef.size || 150;

                  return (
                    <th
                      key={header.id}
                      className="border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 last:border-r-0"
                      style={{
                        width: `${width}px`,
                        minWidth: `${width}px`,
                        maxWidth: `${width}px`,
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  );
                })}
                <th className="sticky right-0 w-12 max-w-12 min-w-12 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-600">
                  <AddColumnButton tableId={tableId} />
                </th>
              </tr>
            ))}
          </thead>

          <tbody>
            {/* Top spacer for virtualization */}
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}

            {/* Virtualized rows */}
            {virtualRows.map((virtualRow) => {
              // Check if this is the "Add row" button row
              if (virtualRow.index === rows.length) {
                return (
                  <tr
                    key="add-row"
                    className="border-t border-gray-200 bg-gray-50"
                  >
                    <td
                      colSpan={visibleColumns.length + 1}
                      className="px-3 py-2 text-left"
                    >
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              }

              const row = rows[virtualRow.index];
              if (!row) return null;

              const rowId = row.original.__rowId;
              const rowIndex = virtualRow.index;

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current.set(rowIndex, el);
                    } else {
                      rowRefs.current.delete(rowIndex);
                    }
                  }}
                  className="border-b border-gray-200 transition-colors hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const columnDef = cell.column.columnDef;
                    const width = columnDef.size || 150;
                    const cellKey = `${rowIndex}-${cellIndex}`;

                    return (
                      <td
                        key={cell.id}
                        ref={(el) => {
                          if (el) {
                            cellRefs.current.set(cellKey, el);
                          } else {
                            cellRefs.current.delete(cellKey);
                          }
                        }}
                        className="border-r border-gray-200 px-3 py-2 text-sm text-gray-900 last:border-r-0"
                        style={{
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          maxWidth: `${width}px`,
                        }}
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
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                  <td className="w-12 max-w-12 min-w-12 px-3 py-2"></td>
                </tr>
              );
            })}

            {/* Bottom spacer for virtualization */}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Right-click row context menu - Airtable style */}
      {rowMenu && (
        <div
          ref={menuRef}
          className="fixed z-[10000] w-52 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
          style={{ top: rowMenu.y, left: rowMenu.x }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Ask Omni...</span>
          </button>
          <button
            type="button"
            onClick={() => handleInsert("above")}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            <span>Insert record above</span>
          </button>
          <button
            type="button"
            onClick={() => handleInsert("below")}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            <span>Insert record below</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>Duplicate record</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            <span>Apply template</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            <span>Expand record</span>
          </button>
          <div className="my-2 border-t border-gray-200" />
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span>Add comment</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span>Copy cell URL</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span>Send record</span>
          </button>
          <div className="my-2 border-t border-gray-200" />
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Delete record</span>
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
    </div>
  );
}
