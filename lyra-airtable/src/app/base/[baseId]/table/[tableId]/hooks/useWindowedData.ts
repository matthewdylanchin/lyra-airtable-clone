"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/trpc/react";
import type { SortType, FilterCondition, TableData } from "../types";

type ColumnType = "TEXT" | "NUMBER";

interface ColumnData {
  id: string;
  name: string;
  type: ColumnType;
  order: number;
}

interface RowData {
  id: string;
  rowIndex: number;
}

interface CellData {
  id: string;
  rowId: string;
  columnId: string;
  textValue: string | null;
  numberValue: number | null;
  updatedAt: Date;
}

interface OptimisticRow {
  row: RowData;
  cells: CellData[];
}

interface OptimisticColumn {
  column: ColumnData;
  cellValues: Map<string, CellData>; // rowId -> cell
}

interface PendingCellEdit {
  rowId: string;
  columnId: string;
  textValue: string | null;
  numberValue: number | null;
  timestamp: number;
}

interface WindowedDataState {
  table: { id: string; name: string; baseId: string } | null;
  columns: ColumnData[];
  totalCount: number;
  rowCache: Map<number, RowData[]>;
  cellCache: Map<string, CellData>;
  loadingRanges: Set<string>;
  isInitialLoading: boolean;
  error: Error | null;
  // Optimistic state
  optimisticRows: Map<string, OptimisticRow>;
  optimisticColumns: Map<string, OptimisticColumn>;
  pendingCellEdits: Map<string, PendingCellEdit>; // "rowId:columnId" -> edit
  deletedRowIds: Set<string>; // Track soft-deleted rows
}

interface UseWindowedDataOptions {
  tableId: string;
  windowSize?: number;
  overscan?: number;
  searchQuery?: string;
  filters?: FilterCondition[];
  filterConjunction?: "and" | "or";
  sorts?: SortType[];
}

interface UseWindowedDataReturn {
  table: WindowedDataState["table"];
  columns: ColumnData[];
  totalCount: number;
  getRowAtIndex: (index: number) => RowData | null;
  getCellValue: (rowId: string, columnId: string) => CellData | null;
  isRowLoaded: (index: number) => boolean;
  loadRange: (startIndex: number, endIndex: number) => Promise<void>;
  isInitialLoading: boolean;
  isLoadingRange: (startIndex: number, endIndex: number) => boolean;
  error: Error | null;
  // Optimistic operations
  addOptimisticRow: (tempId: string) => void;
  insertOptimisticRow: (tempId: string, atIndex: number) => void;
  removeOptimisticRow: (tempId: string) => void;
  replaceOptimisticRowId: (tempId: string, realId: string) => void;
  deleteRowOptimistically: (rowId: string) => void;
  // Column operations
  addOptimisticColumn: (column: {
    id: string;
    name: string;
    type: ColumnType;
    order: number;
  }) => void;
  removeOptimisticColumn: (tempId: string) => void;
  replaceOptimisticColumnId: (tempId: string, realId: string) => void;
  // Cell edit tracking
  setPendingCellEdit: (
    rowId: string,
    columnId: string,
    textValue: string | null,
    numberValue: number | null,
  ) => void;
  clearPendingCellEdit: (rowId: string, columnId: string) => void;
  invalidateCache: () => void;
  // For compatibility
  cellByKey: Map<string, CellData>;
  data: TableData | undefined;
}

const DEFAULT_WINDOW_SIZE = 500;
const DEFAULT_OVERSCAN = 100;

export function useWindowedData({
  tableId,
  windowSize = DEFAULT_WINDOW_SIZE,
  overscan = DEFAULT_OVERSCAN,
  searchQuery,
  filters,
  filterConjunction = "and",
  sorts,
}: UseWindowedDataOptions): UseWindowedDataReturn {
  const [state, setState] = useState<WindowedDataState>({
    table: null,
    columns: [],
    totalCount: 0,
    rowCache: new Map(),
    cellCache: new Map(),
    loadingRanges: new Set(),
    isInitialLoading: true,
    error: null,
    optimisticRows: new Map(),
    optimisticColumns: new Map(),
    pendingCellEdits: new Map(),
    deletedRowIds: new Set(),
  });

  const activeRequests = useRef<Set<string>>(new Set());

  // Track if we're in the middle of a query change
  const queryChangeInProgress = useRef(false);

  const queryParams = useMemo(
    () => ({
      tableId,
      searchQuery: searchQuery || undefined,
      filterConjunction,
      filters:
        filters && filters.length > 0
          ? filters
              .filter(
                (f): f is FilterCondition & { value: string } => !!f.value,
              )
              .map((f) => ({
                columnId: f.columnId,
                operator: f.operator,
                value: f.value,
              }))
          : undefined,
      sorts:
        sorts && sorts.length > 0
          ? sorts.map((s) => ({
              columnId: s.columnId,
              type: "text" as const,
              direction: s.direction,
            }))
          : undefined,
    }),
    [tableId, searchQuery, filterConjunction, filters, sorts],
  );

  const utils = api.useUtils();

  const fetchWindow = useCallback(
    async (offset: number, limit: number) => {
      const rangeKey = `${offset}-${limit}`;

      if (activeRequests.current.has(rangeKey)) {
        return;
      }

      activeRequests.current.add(rangeKey);

      setState((prev) => ({
        ...prev,
        loadingRanges: new Set([...prev.loadingRanges, rangeKey]),
      }));

      try {
        const result = await utils.table.getDataWindowed.fetch({
          tableId,
          offset,
          limit,
          searchQuery: queryParams.searchQuery,
          filterConjunction: queryParams.filterConjunction,
          filters: queryParams.filters,
          sorts: queryParams.sorts,
        });

        setState((prev) => {
          const newRowCache = new Map(prev.rowCache);
          const newCellCache = new Map(prev.cellCache);

          // Only add rows that aren't soft-deleted
          const filteredRows = result.rows.filter((row) => {
            // Ignore rows that replace optimistic ones
            for (const opt of prev.optimisticRows.values()) {
              if (opt.row.id === row.id) return false;
            }
            return !prev.deletedRowIds.has(row.id);
          });

          newRowCache.set(offset, filteredRows);

          // Only add cells that aren't pending edits or from deleted rows
          result.cells.forEach((cell) => {
            const cellKey = `${cell.rowId}:${cell.columnId}`;

            // Skip if this cell has a pending edit
            if (prev.pendingCellEdits.has(cellKey)) {
              return;
            }

            // Skip if row is deleted
            if (prev.deletedRowIds.has(cell.rowId)) {
              return;
            }

            newCellCache.set(cellKey, cell as CellData);
          });

          const newOptimisticColumns = new Map(prev.optimisticColumns);
          const serverColumnIds = new Set(result.columns.map((c) => c.id));

          for (const [tempId, optCol] of prev.optimisticColumns) {
            // If the real column ID exists in server data, remove optimistic version
            if (serverColumnIds.has(optCol.column.id)) {
              newOptimisticColumns.delete(tempId);
            }
          }

          const newLoadingRanges = new Set(prev.loadingRanges);
          newLoadingRanges.delete(rangeKey);

          return {
            ...prev,
            table: result.table,
            columns: result.columns as ColumnData[],
            totalCount: result.totalCount,
            rowCache: newRowCache,
            cellCache: newCellCache,
            loadingRanges: newLoadingRanges,
            isInitialLoading: false,
            error: null,
            optimisticColumns: newOptimisticColumns,
          };
        });
      } catch (error) {
        setState((prev) => {
          const newLoadingRanges = new Set(prev.loadingRanges);
          newLoadingRanges.delete(rangeKey);

          return {
            ...prev,
            loadingRanges: newLoadingRanges,
            isInitialLoading: false,
            error: error as Error,
          };
        });
      } finally {
        activeRequests.current.delete(rangeKey);
      }
    },
    [tableId, queryParams, utils.table.getDataWindowed],
  );

  // Reset on query change - preserve optimistic state
  useEffect(() => {
    queryChangeInProgress.current = true;

    setState((prev) => ({
      ...prev,
      table: null,
      columns: [],
      totalCount: prev.totalCount, // KEEP count
      rowCache: prev.rowCache, // ✅ DO NOT CLEAR
      cellCache: prev.cellCache, // ✅ DO NOT CLEAR
      loadingRanges: new Set(),
      isInitialLoading: true,
      error: null,
      // PRESERVE optimistic state during query changes
      // optimisticRows, optimisticColumns, pendingCellEdits, deletedRowIds remain intact
    }));

    activeRequests.current.clear();

    void fetchWindow(0, windowSize).then(() => {
      queryChangeInProgress.current = false;
    });
  }, [
    tableId,
    queryParams.searchQuery,
    queryParams.filterConjunction,
    JSON.stringify(queryParams.filters),
    JSON.stringify(queryParams.sorts),
    windowSize,
    fetchWindow,
  ]);

  // Get all columns including optimistic
  const allColumns = useMemo(() => {
    const serverColumns = [...state.columns];
    const optimisticCols = Array.from(state.optimisticColumns.values()).map(
      (opt) => opt.column,
    );

    // Merge and sort by order
    const merged = [...serverColumns, ...optimisticCols];
    merged.sort((a, b) => a.order - b.order);

    return merged;
  }, [state.columns, state.optimisticColumns]);

  // Get total count including optimistic rows, excluding deleted
  const effectiveTotalCount = useMemo(() => {
    return (
      state.totalCount + state.optimisticRows.size - state.deletedRowIds.size
    );
  }, [state.totalCount, state.optimisticRows.size, state.deletedRowIds.size]);

  const getRowAtIndex = useCallback(
    (index: number): RowData | null => {
      const serverRowCount = state.totalCount;

      // Optimistic rows
      if (index >= serverRowCount) {
        const optimisticIndex = index - serverRowCount;
        const optimisticRows = Array.from(state.optimisticRows.values());
        return optimisticRows[optimisticIndex]?.row ?? null;
      }

      // Server rows
      for (const [offset, rows] of state.rowCache) {
        if (index >= offset && index < offset + rows.length) {
          const row = rows[index - offset];

          if (!row) return null;
          if (state.deletedRowIds.has(row.id)) return null;

          return row;
        }
      }

      return null;
    },
    [
      state.rowCache,
      state.totalCount,
      state.optimisticRows,
      state.deletedRowIds,
    ],
  );

  // Check if row is loaded
  const isRowLoaded = useCallback(
    (index: number): boolean => {
      return getRowAtIndex(index) !== null;
    },
    [getRowAtIndex],
  );

  // Get cell value - checks pending edits first, then optimistic, then cache
  const getCellValue = useCallback(
    (rowId: string, columnId: string): CellData | null => {
      const cellKey = `${rowId}:${columnId}`;

      // 1. Check pending edits first (highest priority)
      const pendingEdit = state.pendingCellEdits.get(cellKey);
      if (pendingEdit) {
        return {
          id: `pending-${cellKey}`,
          rowId,
          columnId,
          textValue: pendingEdit.textValue,
          numberValue: pendingEdit.numberValue,
          updatedAt: new Date(pendingEdit.timestamp),
        };
      }

      // 2. Check optimistic rows
      const optimisticRow = state.optimisticRows.get(rowId);
      if (optimisticRow) {
        return optimisticRow.cells.find((c) => c.columnId === columnId) ?? null;
      }

      // 3. Check optimistic columns - search by column.id, not map key
      for (const [, optimisticColumn] of state.optimisticColumns) {
        if (optimisticColumn.column.id === columnId) {
          return optimisticColumn.cellValues.get(rowId) ?? null;
        }
      }

      // 4. Finally check cache
      return state.cellCache.get(cellKey) ?? null;
    },
    [
      state.cellCache,
      state.optimisticRows,
      state.optimisticColumns,
      state.pendingCellEdits,
    ],
  );
  // Load a range
  const loadRange = useCallback(
    async (startIndex: number, endIndex: number) => {
      // Only load from actual data, not optimistic
      const actualEnd = Math.min(endIndex, state.totalCount);
      if (startIndex >= actualEnd) return;

      const overscanStart = Math.max(0, startIndex - overscan);
      const overscanEnd = Math.min(state.totalCount, actualEnd + overscan);

      const windowStart = Math.floor(overscanStart / windowSize) * windowSize;
      const windowEnd = Math.ceil(overscanEnd / windowSize) * windowSize;

      const promises: Promise<void>[] = [];

      for (let offset = windowStart; offset < windowEnd; offset += windowSize) {
        const rangeKey = `${offset}-${windowSize}`;

        let needsLoad = true;
        for (const [cachedOffset, cachedRows] of state.rowCache) {
          if (
            offset >= cachedOffset &&
            offset < cachedOffset + cachedRows.length
          ) {
            needsLoad = false;
            break;
          }
        }

        if (
          needsLoad &&
          !state.loadingRanges.has(rangeKey) &&
          !activeRequests.current.has(rangeKey)
        ) {
          promises.push(fetchWindow(offset, windowSize));
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
    },
    [
      state.totalCount,
      state.rowCache,
      state.loadingRanges,
      windowSize,
      overscan,
      fetchWindow,
    ],
  );

  const isLoadingRange = useCallback(
    (startIndex: number, endIndex: number): boolean => {
      const windowStart = Math.floor(startIndex / windowSize) * windowSize;
      const windowEnd = Math.ceil(endIndex / windowSize) * windowSize;

      for (let offset = windowStart; offset < windowEnd; offset += windowSize) {
        const rangeKey = `${offset}-${windowSize}`;
        if (state.loadingRanges.has(rangeKey)) {
          return true;
        }
      }

      return false;
    },
    [state.loadingRanges, windowSize],
  );

  // ========================================
  // OPTIMISTIC ROW OPERATIONS
  // ========================================

  const addOptimisticRow = useCallback((tempId: string) => {
    setState((prev) => {
      const newOptimisticRows = new Map(prev.optimisticRows);

      const optimisticRow: RowData = {
        id: tempId,
        rowIndex: prev.totalCount + prev.optimisticRows.size,
      };

      const columnsToUse = [
        ...prev.columns,
        ...Array.from(prev.optimisticColumns.values()).map((c) => c.column),
      ];

      const optimisticCells: CellData[] = columnsToUse.map((col) => ({
        id: `temp-cell-${col.id}-${tempId}`,
        rowId: tempId,
        columnId: col.id,
        textValue: "",
        numberValue: null,
        updatedAt: new Date(),
      }));

      newOptimisticRows.set(tempId, {
        row: optimisticRow,
        cells: optimisticCells,
      });

      // ✅ KEY CHANGE: Don't add to rowCache!
      return {
        ...prev,
        optimisticRows: newOptimisticRows,
        // rowCache unchanged - keep optimistic separate
      };
    });
  }, []);

  const insertOptimisticRow = useCallback((tempId: string, atIndex: number) => {
    setState((prev) => {
      const newOptimisticRows = new Map(prev.optimisticRows);

      const optimisticRow: RowData = {
        id: tempId,
        rowIndex: atIndex,
      };

      const columnsToUse = [
        ...prev.columns,
        ...Array.from(prev.optimisticColumns.values()).map((opt) => opt.column),
      ];

      const optimisticCells: CellData[] = columnsToUse.map((col) => ({
        id: `temp-cell-${col.id}-${tempId}`,
        rowId: tempId,
        columnId: col.id,
        textValue: "",
        numberValue: null,
        updatedAt: new Date(),
      }));

      newOptimisticRows.set(tempId, {
        row: optimisticRow,
        cells: optimisticCells,
      });

      return {
        ...prev,
        optimisticRows: newOptimisticRows,
      };
    });
  }, []);

  const removeOptimisticRow = useCallback((tempId: string) => {
    setState((prev) => {
      const newOptimisticRows = new Map(prev.optimisticRows);
      newOptimisticRows.delete(tempId);

      const newRowCache = new Map(prev.rowCache);
      for (const [offset, rows] of newRowCache) {
        const filtered = rows.filter((r) => r.id !== tempId);
        if (filtered.length !== rows.length) {
          newRowCache.set(offset, filtered);
        }
      }

      return {
        ...prev,
        optimisticRows: newOptimisticRows,
        rowCache: newRowCache,
        // ✅ KEY CHANGE: Don't modify totalCount
        // totalCount: prev.totalCount - 1, // ❌ REMOVE THIS
      };
    });
  }, []);

  const replaceOptimisticRowId = useCallback(
    (tempId: string, realId: string) => {
      setState((prev) => {
        const optimisticRow = prev.optimisticRows.get(tempId);
        if (!optimisticRow) return prev;

        // ✅ Update the ID in place, don't remove it yet
        const newOptimisticRows = new Map(prev.optimisticRows);

        // Replace temp row with real ID but keep it optimistic
        newOptimisticRows.set(tempId, {
          ...optimisticRow,
          row: {
            ...optimisticRow.row,
            id: realId, // ✅ Update to real ID
          },
        });

        // Update cells to use real ID
        const updatedCells = optimisticRow.cells.map((cell) => ({
          ...cell,
          rowId: realId,
          id: `${realId}-${cell.columnId}`,
        }));

        newOptimisticRows.set(tempId, {
          ...optimisticRow,
          row: { ...optimisticRow.row, id: realId },
          cells: updatedCells,
        });

        // Update pending edits
        const newPendingCellEdits = new Map(prev.pendingCellEdits);
        for (const [key, edit] of newPendingCellEdits) {
          if (key.startsWith(`${tempId}:`)) {
            const columnId = key.split(":")[1];
            newPendingCellEdits.delete(key);
            newPendingCellEdits.set(`${realId}:${columnId}`, {
              ...edit,
              rowId: realId,
            });
          }
        }

        return {
          ...prev,
          optimisticRows: newOptimisticRows,
          pendingCellEdits: newPendingCellEdits,
          // ✅ Don't touch totalCount or rowCache
        };
      });
    },
    [],
  );

  const deleteRowOptimistically = useCallback((rowId: string) => {
    setState((prev) => {
      // Check if it's an optimistic row
      if (prev.optimisticRows.has(rowId)) {
        const newOptimisticRows = new Map(prev.optimisticRows);
        newOptimisticRows.delete(rowId);
        return {
          ...prev,
          optimisticRows: newOptimisticRows,
        };
      }

      // Mark as deleted (soft delete)
      const newDeletedRowIds = new Set(prev.deletedRowIds);
      newDeletedRowIds.add(rowId);

      return {
        ...prev,
        deletedRowIds: newDeletedRowIds,
      };
    });
  }, []);

  // ========================================
  // OPTIMISTIC COLUMN OPERATIONS
  // ========================================

  const addOptimisticColumn = useCallback(
    (column: { id: string; name: string; type: ColumnType; order: number }) => {
      const { id, name, type, order } = column;

      setState((prev) => {
        const newOptimisticColumns = new Map(prev.optimisticColumns);

        const optimisticColumn: ColumnData = {
          id,
          name,
          type,
          order,
        };

        const cellValues = new Map<string, CellData>();

        // Add cells for server rows
        for (const [, rows] of prev.rowCache) {
          rows.forEach((row) => {
            if (!prev.deletedRowIds.has(row.id)) {
              cellValues.set(row.id, {
                id: `temp-cell-${id}-${row.id}`,
                rowId: row.id,
                columnId: id,
                textValue: "",
                numberValue: null,
                updatedAt: new Date(),
              });
            }
          });
        }

        // Add cells for optimistic rows
        prev.optimisticRows.forEach((optRow) => {
          cellValues.set(optRow.row.id, {
            id: `temp-cell-${id}-${optRow.row.id}`,
            rowId: optRow.row.id,
            columnId: id,
            textValue: "",
            numberValue: null,
            updatedAt: new Date(),
          });
        });

        newOptimisticColumns.set(id, {
          column: optimisticColumn,
          cellValues,
        });

        return {
          ...prev,
          optimisticColumns: newOptimisticColumns,
          // ✅ Don't modify state.columns - keep optimistic separate
        };
      });
    },
    [],
  );

  const removeOptimisticColumn = useCallback((tempId: string) => {
    setState((prev) => {
      const newOptimisticColumns = new Map(prev.optimisticColumns);
      newOptimisticColumns.delete(tempId);

      return {
        ...prev,
        optimisticColumns: newOptimisticColumns,
      };
    });
  }, []);

  const replaceOptimisticColumnId = useCallback(
    (tempId: string, realId: string) => {
      setState((prev) => {
        const optimisticColumn = prev.optimisticColumns.get(tempId);
        if (!optimisticColumn) return prev;

        // ✅ Keep the column in optimistic map but update its ID
        const newOptimisticColumns = new Map(prev.optimisticColumns);

        // Update the column with real ID
        const updatedColumn: ColumnData = {
          ...optimisticColumn.column,
          id: realId,
        };

        // Update all cells in this column to use real column ID
        const updatedCellValues = new Map<string, CellData>();

        for (const [rowId, cell] of optimisticColumn.cellValues) {
          const updatedCell: CellData = {
            ...cell,
            columnId: realId,
            id: `${rowId}-${realId}`,
          };
          updatedCellValues.set(rowId, updatedCell);
        }

        // Store updated optimistic column (still keyed by tempId)
        newOptimisticColumns.set(tempId, {
          column: updatedColumn,
          cellValues: updatedCellValues,
        });

        // Update pending edits to use real column ID
        const newPendingCellEdits = new Map(prev.pendingCellEdits);
        for (const [key, edit] of newPendingCellEdits) {
          if (key.endsWith(`:${tempId}`)) {
            const rowId = key.split(":")[0];
            newPendingCellEdits.delete(key);
            newPendingCellEdits.set(`${rowId}:${realId}`, {
              ...edit,
              columnId: realId,
            });
          }
        }

        return {
          ...prev,
          optimisticColumns: newOptimisticColumns,
          pendingCellEdits: newPendingCellEdits,
          // ✅ Don't touch state.columns or cellCache
          // The column stays in optimistic map until next fetch
        };
      });
    },
    [],
  );

  // ========================================
  // CELL EDIT TRACKING
  // ========================================

  const setPendingCellEdit = useCallback(
    (
      rowId: string,
      columnId: string,
      textValue: string | null,
      numberValue: number | null,
    ) => {
      setState((prev) => {
        const newPendingCellEdits = new Map(prev.pendingCellEdits);
        const cellKey = `${rowId}:${columnId}`;

        newPendingCellEdits.set(cellKey, {
          rowId,
          columnId,
          textValue,
          numberValue,
          timestamp: Date.now(),
        });

        return {
          ...prev,
          pendingCellEdits: newPendingCellEdits,
        };
      });
    },
    [],
  );

  const clearPendingCellEdit = useCallback(
    (rowId: string, columnId: string) => {
      setState((prev) => {
        const newPendingCellEdits = new Map(prev.pendingCellEdits);
        const cellKey = `${rowId}:${columnId}`;
        newPendingCellEdits.delete(cellKey);

        return {
          ...prev,
          pendingCellEdits: newPendingCellEdits,
        };
      });
    },
    [],
  );

  const invalidateCache = useCallback(() => {
    setState((prev) => ({
      ...prev,
      rowCache: new Map(),
      cellCache: new Map(),
      isInitialLoading: true,
      // Clear soft deletes on full refresh
      deletedRowIds: new Set(),
    }));

    activeRequests.current.clear();

    void fetchWindow(0, windowSize);
  }, [fetchWindow, windowSize]);

  // Build compatibility data object
  const data = useMemo((): TableData | undefined => {
    if (!state.table || allColumns.length === 0) return undefined;

    const allRows: RowData[] = [];
    const sortedOffsets = Array.from(state.rowCache.keys()).sort(
      (a, b) => a - b,
    );

    for (const offset of sortedOffsets) {
      const rows = state.rowCache.get(offset);
      if (rows) {
        // Filter out deleted rows
        allRows.push(...rows.filter((r) => !state.deletedRowIds.has(r.id)));
      }
    }

    // Add optimistic rows at the end
    for (const [, optimistic] of state.optimisticRows) {
      allRows.push(optimistic.row);
    }

    const allCells: CellData[] = [];

    // Add cached cells (excluding pending edits and deleted rows)
    for (const [key, cell] of state.cellCache) {
      if (
        !state.pendingCellEdits.has(key) &&
        !state.deletedRowIds.has(cell.rowId)
      ) {
        allCells.push(cell);
      }
    }

    // Add optimistic row cells
    for (const [, optimistic] of state.optimisticRows) {
      allCells.push(...optimistic.cells);
    }

    // Add optimistic column cells
    for (const [, optimisticCol] of state.optimisticColumns) {
      allCells.push(...optimisticCol.cellValues.values());
    }

    // Add pending edits as cells
    for (const [, pendingEdit] of state.pendingCellEdits) {
      allCells.push({
        id: `pending-${pendingEdit.rowId}:${pendingEdit.columnId}`,
        rowId: pendingEdit.rowId,
        columnId: pendingEdit.columnId,
        textValue: pendingEdit.textValue,
        numberValue: pendingEdit.numberValue,
        updatedAt: new Date(pendingEdit.timestamp),
      });
    }

    return {
      table: state.table,
      columns: allColumns,
      rows: allRows,
      cells: allCells,
      totalCount: effectiveTotalCount,
      nextCursor: undefined,
    };
  }, [
    state.table,
    allColumns,
    state.rowCache,
    state.cellCache,
    state.optimisticRows,
    state.optimisticColumns,
    state.pendingCellEdits,
    state.deletedRowIds,
    effectiveTotalCount,
  ]);

  // Build cellByKey including all sources
  const cellByKey = useMemo(() => {
    const map = new Map<string, CellData>();

    // Add cached cells (lowest priority)
    for (const [key, cell] of state.cellCache) {
      if (!state.deletedRowIds.has(cell.rowId)) {
        map.set(key, cell);
      }
    }

    // Add optimistic row cells
    for (const [, optimistic] of state.optimisticRows) {
      for (const cell of optimistic.cells) {
        map.set(`${cell.rowId}:${cell.columnId}`, cell);
      }
    }

    // Add optimistic column cells
    for (const [, optimisticCol] of state.optimisticColumns) {
      for (const [rowId, cell] of optimisticCol.cellValues) {
        map.set(`${rowId}:${cell.columnId}`, cell);
      }
    }

    // Add pending edits (highest priority)
    for (const [key, pendingEdit] of state.pendingCellEdits) {
      map.set(key, {
        id: `pending-${key}`,
        rowId: pendingEdit.rowId,
        columnId: pendingEdit.columnId,
        textValue: pendingEdit.textValue,
        numberValue: pendingEdit.numberValue,
        updatedAt: new Date(pendingEdit.timestamp),
      });
    }

    return map;
  }, [
    state.cellCache,
    state.optimisticRows,
    state.optimisticColumns,
    state.pendingCellEdits,
    state.deletedRowIds,
  ]);

  return {
    table: state.table,
    columns: allColumns,
    totalCount: effectiveTotalCount,
    getRowAtIndex,
    getCellValue,
    isRowLoaded,
    loadRange,
    isInitialLoading: state.isInitialLoading,
    isLoadingRange,
    error: state.error,
    addOptimisticRow,
    insertOptimisticRow,
    removeOptimisticRow,
    replaceOptimisticRowId,
    deleteRowOptimistically,
    addOptimisticColumn,
    removeOptimisticColumn,
    replaceOptimisticColumnId,
    setPendingCellEdit,
    clearPendingCellEdit,
    invalidateCache,
    cellByKey,
    data,
  };
}
