"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  onOpenSearch,
  queryKey,
  onFlushPendingEdits,
  onFlushPendingColumnEdits,
  totalCount,
  isRowLoaded,
  // Optimistic row functions
  addOptimisticRow,
  insertOptimisticRow,
  removeOptimisticRow,
  deleteRowOptimistically,
  // NEW: Optimistic column functions
  addOptimisticColumn,
  removeOptimisticColumn,
  replaceOptimisticColumnId,
}: {
  table: Table<TableRow>;
  addColumnOpen: AddColumnState;
  onCloseAddColumn: () => void;
  focusedRowIndex?: number | null;
  focusedColumnIndex?: number | null;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  onOpenSearch: () => void;
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
  onFlushPendingEdits?: (tempId: string, realId: string) => void;
  onFlushPendingColumnEdits?: (tempId: string, realId: string) => void;
  totalCount?: number;
  isRowLoaded?: (index: number) => boolean;
  // Optimistic row functions
  addOptimisticRow?: (tempId: string) => void;
  insertOptimisticRow?: (tempId: string, atIndex: number) => void;
  removeOptimisticRow?: (tempId: string) => void;
  deleteRowOptimistically?: (rowId: string) => void;
  // NEW: Optimistic column functions
  addOptimisticColumn?: (column: {
    id: string;
    name: string;
    type: "TEXT" | "NUMBER";
    order: number;
  }) => void;
  removeOptimisticColumn?: (tempId: string) => void;
  replaceOptimisticColumnId?: (tempId: string, realId: string) => void;
}) {
  const { tableId } = useParams<{ tableId: string }>();
  const utils = api.useUtils();

  // Track pending temp IDs
  const pendingTempIds = useRef<Set<string>>(new Set());

  // ⚡ OPTIMISTIC: Append row at bottom
  const appendRow = api.row.create.useMutation({
    onMutate: () => {
      const tempRowId = `temp-${crypto.randomUUID()}`;
      pendingTempIds.current.add(tempRowId);

      if (addOptimisticRow) {
        addOptimisticRow(tempRowId);
      }

      return { tempRowId };
    },

    onSuccess: (realRow, _, ctx) => {
      if (ctx?.tempRowId) {
        pendingTempIds.current.delete(ctx.tempRowId);

        if (onFlushPendingEdits) {
          onFlushPendingEdits(ctx.tempRowId, realRow.id);
        }
      }
      // ✅ KEY CHANGE: Don't invalidate cache!
      // await utils.table.getDataWindowed.invalidate({ tableId }); // ❌ REMOVE
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.tempRowId) {
        pendingTempIds.current.delete(ctx.tempRowId);

        if (removeOptimisticRow) {
          removeOptimisticRow(ctx.tempRowId);
        }
      }
    },
  });
  // ⚡ OPTIMISTIC: Insert row above/below
  const insertRow = api.row.insertAtPosition.useMutation({
    onMutate: (variables) => {
      const tempRowId = `temp-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingTempIds.current.add(tempRowId);

      // Find the anchor row index
      const rows = table.getRowModel().rows;
      const anchorRow = rows.find(
        (r) => r.original.__rowId === variables.anchorRowId,
      );
      const anchorIndex = anchorRow?.index ?? 0;
      const newIndex =
        variables.position === "above" ? anchorIndex : anchorIndex + 1;

      // Add optimistic row at position
      if (insertOptimisticRow) {
        insertOptimisticRow(tempRowId, newIndex);
      }

      return { tempRowId };
    },
    onSuccess: async (realRow, _, ctx) => {
      if (ctx?.tempRowId && realRow?.id) {
        pendingTempIds.current.delete(ctx.tempRowId);

        if (onFlushPendingEdits) {
          onFlushPendingEdits(ctx.tempRowId, realRow.id);
        }
      }

      // ✅ Delay invalidation to let optimistic update settle
      setTimeout(() => {
        void utils.table.getDataWindowed.invalidate({ tableId });
      }, 100);

      setRowMenu(null);
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.tempRowId) {
        pendingTempIds.current.delete(ctx.tempRowId);

        if (removeOptimisticRow) {
          removeOptimisticRow(ctx.tempRowId);
        }
      }
      setRowMenu(null);
    },
  });

  // ⚡ OPTIMISTIC: Delete row
  const deleteRow = api.row.delete.useMutation({
    onMutate: (rowId) => {
      // Optimistically delete
      if (deleteRowOptimistically) {
        deleteRowOptimistically(rowId);
      }

      return { rowId };
    },

    onSuccess: async () => {
      await utils.table.getDataWindowed.invalidate({ tableId });
      setRowMenu(null);
    },

    onError: async (_err, _vars) => {
      // Refresh to restore the row
      await utils.table.getDataWindowed.invalidate({ tableId });
      setRowMenu(null);
    },
  });

  // Context menu state
  const [rowMenu, setRowMenu] = useState<RowContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openDirection, setOpenDirection] = useState<"up" | "down">("down");

  useEffect(() => {
    if (!rowMenu) return;

    const menuHeight = 300;
    const buffer = 16;
    const spaceBelow = window.innerHeight - rowMenu.y;

    if (spaceBelow < menuHeight + buffer) {
      setOpenDirection("up");
    } else {
      setOpenDirection("down");
    }
  }, [rowMenu]);

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

  // Allow rapid clicking
  const handleAddRow = useCallback(() => {
    void appendRow.mutate({ tableId });
  }, [appendRow, tableId]);

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const visibleColumns = table.getVisibleLeafColumns();

  const headerRef = useRef<HTMLTableSectionElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1]!.end
      : 0;

  // Vertical scrolling
  useEffect(() => {
    if (focusedRowIndex == null) return;
    if (focusedRowIndex < 0 || focusedRowIndex >= (totalCount ?? rows.length))
      return;

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
  }, [
    focusedRowIndex,
    totalCount,
    rows.length,
    rowVirtualizer,
    tableContainerRef,
  ]);

  // Horizontal scrolling
  useEffect(() => {
    if (focusedRowIndex == null || focusedColumnIndex == null) return;
    if (focusedRowIndex < 0 || focusedRowIndex >= (totalCount ?? rows.length))
      return;
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
    totalCount,
    rows.length,
    visibleColumns.length,
    tableContainerRef,
  ]);

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
                    onFlushPendingColumnEdits={onFlushPendingColumnEdits}
                    // Pass column optimistic functions
                    addOptimisticColumn={addOptimisticColumn}
                    removeOptimisticColumn={removeOptimisticColumn}
                    replaceOptimisticColumnId={replaceOptimisticColumnId}
                  />
                </th>
              </tr>
            ))}
          </thead>

          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}

            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isLoaded = isRowLoaded
                ? isRowLoaded(virtualRow.index)
                : !!row;

              // Show skeleton for unloaded rows
              if (!row || !isLoaded) {
                return (
                  <tr
                    key={`skeleton-${virtualRow.index}`}
                    className="animate-pulse"
                    style={{ height: 35 }}
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
                        <div className="h-4 rounded bg-gray-200" />
                      </td>
                    ))}
                    <td className="w-12 max-w-12 min-w-12 px-3 py-2" />
                  </tr>
                );
              }

              const rowId = row.original.__rowId;
              const rowIndex = virtualRow.index;
              const isPlaceholder = rowId.startsWith("placeholder-");

              if (isPlaceholder) {
                return (
                  <tr
                    key={`placeholder-${virtualRow.index}`}
                    className="animate-pulse"
                    style={{ height: 35 }}
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
                        <div className="h-4 rounded bg-gray-200" />
                      </td>
                    ))}
                    <td className="w-12 max-w-12 min-w-12 px-3 py-2" />
                  </tr>
                );
              }

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
                  style={{ height: 35 }}
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
                  <td className="w-12 max-w-12 min-w-12 px-3 py-2" />
                </tr>
              );
            })}

            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}

            {/* Add Row button */}
            <tr
              className="group cursor-pointer hover:bg-gray-50"
              onClick={handleAddRow}
            >
              {visibleColumns.map((col, colIndex) => {
                const width = col.getSize();
                const isFirstColumn = colIndex === 0;

                return (
                  <td
                    key={`add-row-${col.id}`}
                    className="border-r border-b border-gray-200 last:border-r-0"
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      padding: 0,
                    }}
                  >
                    {isFirstColumn ? (
                      <div className="flex h-9 w-full items-center justify-center text-gray-400 transition-colors group-hover:text-gray-600">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-9" />
                    )}
                  </td>
                );
              })}
              <td className="w-12 max-w-12 min-w-12 border-b border-gray-200" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {rowMenu && (
        <div
          ref={menuRef}
          className="fixed z-[10000] w-75 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
          style={{
            left: rowMenu.x,
            ...(openDirection === "down"
              ? { top: rowMenu.y }
              : { bottom: window.innerHeight - rowMenu.y }),
          }}
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
          onFlushPendingColumnEdits={onFlushPendingColumnEdits}
          // Pass column optimistic functions
          addOptimisticColumn={addOptimisticColumn}
          removeOptimisticColumn={removeOptimisticColumn}
          replaceOptimisticColumnId={replaceOptimisticColumnId}
        />
      )}
    </div>
  );
}
