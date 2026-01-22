"use client";

import { useEffect, useRef, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import type { Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
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
  focusedRowIndex,
  focusedColumnIndex,
  rowVirtualizer,
  tableContainerRef,
  isFetchingNextPage,
  onOpenSearch, // ✅ Add this
  queryKey,
}: {
  table: Table<TableRow>;
  addColumnOpen: AddColumnState;
  onCloseAddColumn: () => void;
  focusedRowIndex?: number | null;
  focusedColumnIndex?: number | null;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  onOpenSearch: () => void; // ✅ Add this type
  queryKey: {
    tableId: string;
    limit: number;
    searchQuery?: string;
    filterConjunction?: "and" | "or";
    filters?: {
      columnId: string;
      operator: string;
      value: string;
    }[];
    sorts?: {
      columnId: string;
      direction: "asc" | "desc";
      type?: "text" | "number";
    }[];
  };
}) {
  const { tableId } = useParams<{ tableId: string }>();
  const utils = api.useUtils();

  // replace tempRowIds helper
  function replaceTempRowId(tempId: string, realId: string) {
    utils.table.getData.setInfiniteData(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          rows: page.rows.map((r) =>
            r.id === tempId ? { ...r, id: realId } : r,
          ),
          cells: page.cells.map((c) =>
            c.rowId === tempId ? { ...c, rowId: realId } : c,
          ),
        })),
      };
    });
  }
  /* ---------- Row mutations with OPTIMISTIC UPDATES ---------- */

  // ⚡ OPTIMISTIC: Append at bottom (used by "+ Add row")
  const appendRow = api.row.create.useMutation({
    onMutate: async () => {
      // Cancel outgoing refetches
      await utils.table.getData.cancel(queryKey);

      // Snapshot previous data
      const previousData = utils.table.getData.getInfiniteData(queryKey);

      const tempRowId = `temp-${crypto.randomUUID()}`;

      // Get current row count
      const currentRowCount = previousData?.pages[0]?.totalCount ?? 0;
      const newRowIndex = currentRowCount;

      // ✨ Optimistically add row to cache
      utils.table.getData.setInfiniteData(queryKey, (old) => {
        if (!old?.pages.length) return old;

        // Create temporary row with temp ID
        const tempRow = {
          id: tempRowId,
          rowIndex: newRowIndex,
        };

        // Create empty cells for new row
        const columns = old.pages[0]?.columns ?? [];
        const tempCells = columns.map((col) => ({
          id: `temp-cell-${col.id}-${crypto.randomUUID()}`,
          rowId: tempRowId,
          columnId: col.id,
          textValue: "",
          numberValue: null,
          updatedAt: new Date(),
        }));

        // Add to last page
        const updatedPages = [...old.pages];
        const lastPageIndex = updatedPages.length - 1;
        const lastPage = updatedPages[lastPageIndex];

        if (lastPage) {
          updatedPages[lastPageIndex] = {
            ...lastPage,
            rows: [...lastPage.rows, tempRow],
            cells: [...lastPage.cells, ...tempCells],
            totalCount: currentRowCount + 1,
          };
        }

        return {
          ...old,
          pages: updatedPages,
        };
      });

      return { previousData, tempRowId };
    },

    onSuccess: (realRow, _, ctx) => {
      // Refetch to get real IDs
      // await utils.table.getData.invalidate(queryKey);
      replaceTempRowId(ctx.tempRowId, realRow.id);
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previousData) {
        utils.table.getData.setInfiniteData(queryKey, ctx.previousData);
      }
    },
  });

  // ⚡ OPTIMISTIC: Insert above / below
  const insertRow = api.row.insertAtPosition.useMutation({
    onMutate: async (variables) => {
      await utils.table.getData.cancel(queryKey);
      const previousData = utils.table.getData.getInfiniteData(queryKey);

      // Optimistically insert row
      utils.table.getData.setInfiniteData(queryKey, (old) => {
        if (!old?.pages.length) return old;

        const tempRowId = `temp-row-${Date.now()}`;
        const columns = old.pages[0]?.columns ?? [];

        // Find the anchor row's index
        let anchorRowIndex = -1;
        for (const page of old.pages) {
          const row = page.rows.find((r) => r.id === variables.anchorRowId);
          if (row) {
            anchorRowIndex = row.rowIndex;
            break;
          }
        }

        const newRowIndex =
          variables.position === "above" ? anchorRowIndex : anchorRowIndex + 1;

        const tempRow = {
          id: tempRowId,
          rowIndex: newRowIndex,
        };

        const tempCells = columns.map((col) => ({
          id: `temp-cell-${col.id}-${Date.now()}`,
          rowId: tempRowId,
          columnId: col.id,
          textValue: "",
          numberValue: null,
          updatedAt: new Date(),
        }));

        // Insert into appropriate page
        const updatedPages = old.pages.map((page) => {
          const totalCount = (page.totalCount ?? 0) + 1;
          return {
            ...page,
            rows: [...page.rows, tempRow],
            cells: [...page.cells, ...tempCells],
            totalCount,
          };
        });

        return {
          ...old,
          pages: updatedPages,
        };
      });

      return { previousData };
    },

    onSuccess: async () => {
      await utils.table.getData.invalidate(queryKey);
      setRowMenu(null);
    },

    onError: (err, variables, context) => {
      console.error("Failed to insert row:", err);
      if (context?.previousData) {
        utils.table.getData.setInfiniteData(queryKey, context.previousData);
      }
      setRowMenu(null);
    },
  });

  // ⚡ OPTIMISTIC: Delete row
  const deleteRow = api.row.delete.useMutation({
    onMutate: async (rowId) => {
      await utils.table.getData.cancel(queryKey);
      const previousData = utils.table.getData.getInfiniteData(queryKey);

      // Optimistically remove row
      utils.table.getData.setInfiniteData(queryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            rows: page.rows.filter((r) => r.id !== rowId),
            cells: page.cells.filter((c) => c.rowId !== rowId),
            totalCount: (page.totalCount ?? 0) - 1,
          })),
        };
      });

      return { previousData };
    },

    onSuccess: async () => {
      await utils.table.getData.invalidate(queryKey);
      setRowMenu(null);
    },

    onError: (err, variables, context) => {
      console.error("Failed to delete row:", err);
      if (context?.previousData) {
        utils.table.getData.setInfiniteData(queryKey, context.previousData);
      }
      setRowMenu(null);
    },
  });

  /* ---------- Right-click context menu state ---------- */

  const [rowMenu, setRowMenu] = useState<RowContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  /* ---------- Refs for scrolling ---------- */
  const headerRef = useRef<HTMLTableSectionElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  /* ---------- Get virtual items ---------- */
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1]!.end
      : 0;

  /* ---------- Vertical scrolling ---------- */
  useEffect(() => {
    if (focusedRowIndex == null) return;
    if (focusedRowIndex < 0 || focusedRowIndex >= rows.length) return;

    const container = tableContainerRef.current;
    const header = headerRef.current;
    const focusedRowElement = rowRefs.current.get(focusedRowIndex);

    if (!container || !header || !focusedRowElement) {
      rowVirtualizer.scrollToIndex(focusedRowIndex, { align: "auto" });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const rowRect = focusedRowElement.getBoundingClientRect();

    const visibleTop = containerRect.top + headerRect.height;
    const visibleBottom = containerRect.bottom;

    const isFullyVisible =
      rowRect.top >= visibleTop && rowRect.bottom <= visibleBottom;

    if (isFullyVisible) return;

    const currentScrollTop = container.scrollTop;
    let newScrollTop = currentScrollTop;

    if (rowRect.top < visibleTop) {
      const difference = visibleTop - rowRect.top;
      newScrollTop = currentScrollTop - difference;
    } else if (rowRect.bottom > visibleBottom) {
      const difference = rowRect.bottom - visibleBottom;
      newScrollTop = currentScrollTop + difference;
    }

    container.scrollTop = newScrollTop;
  }, [focusedRowIndex, rows.length, rowVirtualizer, tableContainerRef]);

  /* ---------- Horizontal scrolling ---------- */
  useEffect(() => {
    if (focusedRowIndex == null || focusedColumnIndex == null) return;
    if (focusedRowIndex < 0 || focusedRowIndex >= rows.length) return;
    if (focusedColumnIndex < 0 || focusedColumnIndex >= visibleColumns.length)
      return;

    const container = tableContainerRef.current;
    const cellKey = `${focusedRowIndex}-${focusedColumnIndex}`;
    const focusedCellElement = cellRefs.current.get(cellKey);

    if (!container || !focusedCellElement) return;

    const containerRect = container.getBoundingClientRect();
    const cellRect = focusedCellElement.getBoundingClientRect();

    const visibleLeft = containerRect.left;
    const visibleRight = containerRect.right;

    const isFullyVisible =
      cellRect.left >= visibleLeft && cellRect.right <= visibleRight;

    if (isFullyVisible) return;

    const currentScrollLeft = container.scrollLeft;
    let newScrollLeft = currentScrollLeft;

    if (cellRect.left < visibleLeft) {
      const difference = visibleLeft - cellRect.left;
      newScrollLeft = currentScrollLeft - difference;
    } else if (cellRect.right > visibleRight) {
      const difference = cellRect.right - visibleRight;
      newScrollLeft = currentScrollLeft + difference;
    }

    container.scrollLeft = newScrollLeft;
  }, [
    focusedRowIndex,
    focusedColumnIndex,
    rows.length,
    visibleColumns.length,
    tableContainerRef,
  ]);
  /* ---------- Render ---------- */

  const tableWidth = visibleColumns.reduce(
    (sum, col) => sum + col.getSize(),
    0,
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div ref={tableContainerRef} className="h-full overflow-auto">
        <table
          className="border-collapse"
          style={{
            width: `${tableWidth}px`,
            minWidth: `${tableWidth}px`,
          }}
        >
          <thead
            ref={headerRef}
            className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm"
          >
            {headerGroups.map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const width = header.getSize();

                  return (
                    <th
                      key={header.id}
                      className="border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 last:border-r-0"
                      style={{
                        width: `${width}px`,
                        minWidth: `${width}px`,
                        maxWidth: `${width}px`,
                        position: "relative",
                      }}
                    >
                      <div className="flex h-full items-center justify-between gap-1">
                        <div className="flex-1 truncate">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </div>

                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute top-0 right-[-2px] h-full w-[4px] cursor-col-resize touch-none select-none"
                          style={{ userSelect: "none" }}
                        >
                          <div
                            className={`absolute top-0 right-[1px] h-full w-[2px] ${
                              header.column.getIsResizing()
                                ? "bg-blue-500"
                                : "bg-transparent hover:bg-blue-400"
                            }`}
                          />
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th className="relative w-25 max-w-25 min-w-25 border-r border-b border-l border-gray-200 p-0">
                  <AddColumnButton
                    tableId={tableId}
                    queryKey={queryKey}
                    className="absolute inset-0"
                  />
                </th>
              </tr>
            ))}
          </thead>

          <tbody>
            {/* Top spacer */}
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}

            {/* Virtualized rows */}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];

              // Skeleton for unloaded rows
              if (!row) {
                return (
                  <tr
                    key={`skeleton-${virtualRow.index}`}
                    className="animate-pulse"
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className="border-r border-b border-gray-200 last:border-r-0"
                        style={{
                          width: `${col.getSize()}px`,
                          minWidth: `${col.getSize()}px`,
                          maxWidth: `${col.getSize()}px`,
                          padding: "8px 12px",
                        }}
                      >
                        <div className="h-4 rounded bg-gray-200"></div>
                      </td>
                    ))}
                    <td className="w-12 max-w-12 min-w-12 px-3 py-2"></td>
                  </tr>
                );
              }

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
                  className="transition-colors hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const width = cell.column.getSize();
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
                        className="border-r border-b border-gray-200 last:border-r-0"
                        style={{
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          maxWidth: `${width}px`,
                          padding: 0,
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

            {/* Bottom spacer */}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}

            {/* Loading indicator */}
            {isFetchingNextPage && (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="py-2 text-center"
                >
                  <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading...
                  </div>
                </td>
              </tr>
            )}

            {/* Add row button */}
            <tr className="border-t border-gray-200 bg-gray-50">
              <td
                colSpan={visibleColumns.length}
                className="px-3 py-2 text-left"
              >
                <button
                  type="button"
                  onClick={handleAddRow}
                  disabled={appendRow.isPending}
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
                  Add Row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Context menu ... (keep your existing menu code) */}
      {rowMenu && (
        <div
          ref={menuRef}
          className="fixed z-[10000] w-75 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
          style={{ top: rowMenu.y, left: rowMenu.x }}
        >
          {/* Ask Omni - Static */}
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

          {/* Insert record above - Functional */}
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

          {/* Insert record below - Functional */}
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

          {/* Duplicate record - Static */}
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

          {/* Apply template - Static */}
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

          {/* Expand record - Static */}
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

          {/* Divider */}
          <div className="my-2 border-t border-gray-200" />

          {/* Add comment - Static */}
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

          {/* Copy cell URL - Static */}
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

          {/* Send record - Static */}
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

          {/* Divider */}
          <div className="my-2 border-t border-gray-200" />

          {/* Delete record - Functional */}
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Delete record</span>
          </button>
        </div>
      )}

      {addColumnOpen && (
        <AddColumnButton
          tableId={tableId}
          insert={addColumnOpen.insert}
          onClose={onCloseAddColumn}
          autoOpen
          initialPosition={addColumnOpen.position}
          queryKey={queryKey}
        />
      )}
    </div>
  );
}
