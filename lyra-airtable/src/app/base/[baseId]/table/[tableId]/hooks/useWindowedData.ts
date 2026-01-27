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

interface WindowedDataState {
  table: { id: string; name: string; baseId: string } | null;
  columns: ColumnData[];
  totalCount: number;
  rowCache: Map<number, RowData[]>;
  cellCache: Map<string, CellData>;
  loadingRanges: Set<string>;
  isInitialLoading: boolean;
  error: Error | null;
  // Optimistic rows stored separately
  optimisticRows: Map<string, OptimisticRow>;
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
  });

  const activeRequests = useRef<Set<string>>(new Set());

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

          newRowCache.set(offset, result.rows as RowData[]);

          result.cells.forEach((cell) => {
            newCellCache.set(
              `${cell.rowId}:${cell.columnId}`,
              cell as CellData,
            );
          });

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

  // Reset on query change
  useEffect(() => {
    setState({
      table: null,
      columns: [],
      totalCount: 0,
      rowCache: new Map(),
      cellCache: new Map(),
      loadingRanges: new Set(),
      isInitialLoading: true,
      error: null,
      optimisticRows: new Map(),
    });

    activeRequests.current.clear();

    void fetchWindow(0, windowSize);
  }, [
    tableId,
    queryParams.searchQuery,
    queryParams.filterConjunction,
    JSON.stringify(queryParams.filters),
    JSON.stringify(queryParams.sorts),
    windowSize,
    fetchWindow,
  ]);

  // Get total count including optimistic rows
  const effectiveTotalCount = state.totalCount + state.optimisticRows.size;

  // Get row at index - checks optimistic rows first (they're at the end)
  const getRowAtIndex = useCallback(
    (index: number): RowData | null => {
      // Check if this index is an optimistic row (at the end)
      if (index >= state.totalCount) {
        const optimisticIndex = index - state.totalCount;
        const optimisticEntries = Array.from(state.optimisticRows.values());
        if (optimisticIndex < optimisticEntries.length) {
          return optimisticEntries[optimisticIndex]?.row ?? null;
        }
        return null;
      }

      // Check cached data
      for (const [offset, rows] of state.rowCache) {
        if (index >= offset && index < offset + rows.length) {
          return rows[index - offset] ?? null;
        }
      }

      return null;
    },
    [state.rowCache, state.totalCount, state.optimisticRows],
  );

  // Check if row is loaded
  const isRowLoaded = useCallback(
    (index: number): boolean => {
      // Optimistic rows are always "loaded"
      if (index >= state.totalCount) {
        const optimisticIndex = index - state.totalCount;
        return optimisticIndex < state.optimisticRows.size;
      }

      for (const [offset, rows] of state.rowCache) {
        if (index >= offset && index < offset + rows.length) {
          return true;
        }
      }

      return false;
    },
    [state.rowCache, state.totalCount, state.optimisticRows.size],
  );

  // Get cell value - checks optimistic rows first
  const getCellValue = useCallback(
    (rowId: string, columnId: string): CellData | null => {
      // Check optimistic rows
      const optimistic = state.optimisticRows.get(rowId);
      if (optimistic) {
        return optimistic.cells.find((c) => c.columnId === columnId) ?? null;
      }

      return state.cellCache.get(`${rowId}:${columnId}`) ?? null;
    },
    [state.cellCache, state.optimisticRows],
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

  // Add optimistic row at the end
  const addOptimisticRow = useCallback((tempId: string) => {
    setState((prev) => {
      const newOptimisticRows = new Map(prev.optimisticRows);

      const newRowIndex = prev.totalCount + prev.optimisticRows.size;

      const optimisticRow: RowData = {
        id: tempId,
        rowIndex: newRowIndex,
      };

      const optimisticCells: CellData[] = prev.columns.map((col) => ({
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

  // Insert optimistic row at specific index
  const insertOptimisticRow = useCallback((tempId: string, atIndex: number) => {
    setState((prev) => {
      const newOptimisticRows = new Map(prev.optimisticRows);

      const optimisticRow: RowData = {
        id: tempId,
        rowIndex: atIndex,
      };

      const optimisticCells: CellData[] = prev.columns.map((col) => ({
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

  // Remove optimistic row (on error)
  const removeOptimisticRow = useCallback((tempId: string) => {
    setState((prev) => {
      const newOptimisticRows = new Map(prev.optimisticRows);
      newOptimisticRows.delete(tempId);

      return {
        ...prev,
        optimisticRows: newOptimisticRows,
      };
    });
  }, []);

  // Replace temp ID with real ID
  const replaceOptimisticRowId = useCallback(
    (tempId: string, realId: string) => {
      setState((prev) => {
        const optimisticRow = prev.optimisticRows.get(tempId);
        if (!optimisticRow) return prev;

        const newOptimisticRows = new Map(prev.optimisticRows);
        newOptimisticRows.delete(tempId);

        // Add to cell cache with real ID
        const newCellCache = new Map(prev.cellCache);
        optimisticRow.cells.forEach((cell) => {
          newCellCache.set(`${realId}:${cell.columnId}`, {
            ...cell,
            id: cell.id.replace(tempId, realId),
            rowId: realId,
          });
        });

        // Add to row cache at the end of the last cached window
        const newRowCache = new Map(prev.rowCache);
        const maxOffset = Math.max(...Array.from(newRowCache.keys()), 0);
        const existingRows = newRowCache.get(maxOffset) ?? [];
        newRowCache.set(maxOffset, [
          ...existingRows,
          { ...optimisticRow.row, id: realId },
        ]);

        return {
          ...prev,
          optimisticRows: newOptimisticRows,
          cellCache: newCellCache,
          rowCache: newRowCache,
          totalCount: prev.totalCount + 1,
        };
      });
    },
    [],
  );

  // Delete row optimistically
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

      // Otherwise, remove from cache
      const newRowCache = new Map<number, RowData[]>();
      const newCellCache = new Map(prev.cellCache);

      // Remove cells for this row
      for (const key of newCellCache.keys()) {
        if (key.startsWith(`${rowId}:`)) {
          newCellCache.delete(key);
        }
      }

      // Remove row from cache
      for (const [offset, rows] of prev.rowCache) {
        const filteredRows = rows.filter((r) => r.id !== rowId);
        if (filteredRows.length > 0) {
          newRowCache.set(offset, filteredRows);
        }
      }

      return {
        ...prev,
        rowCache: newRowCache,
        cellCache: newCellCache,
        totalCount: Math.max(0, prev.totalCount - 1),
      };
    });
  }, []);

  const invalidateCache = useCallback(() => {
    setState((prev) => ({
      ...prev,
      rowCache: new Map(),
      cellCache: new Map(),
      optimisticRows: new Map(),
      isInitialLoading: true,
    }));

    activeRequests.current.clear();

    void fetchWindow(0, windowSize);
  }, [fetchWindow, windowSize]);

  // Build compatibility data object
  const data = useMemo((): TableData | undefined => {
    if (!state.table || state.columns.length === 0) return undefined;

    const allRows: RowData[] = [];
    const sortedOffsets = Array.from(state.rowCache.keys()).sort(
      (a, b) => a - b,
    );

    for (const offset of sortedOffsets) {
      const rows = state.rowCache.get(offset);
      if (rows) {
        allRows.push(...rows);
      }
    }

    // Add optimistic rows at the end
    for (const [, optimistic] of state.optimisticRows) {
      allRows.push(optimistic.row);
    }

    const allCells: CellData[] = Array.from(state.cellCache.values());

    // Add optimistic cells
    for (const [, optimistic] of state.optimisticRows) {
      allCells.push(...optimistic.cells);
    }

    return {
      table: state.table,
      columns: state.columns,
      rows: allRows,
      cells: allCells,
      totalCount: effectiveTotalCount,
      nextCursor: undefined,
    };
  }, [
    state.table,
    state.columns,
    state.rowCache,
    state.cellCache,
    state.optimisticRows,
    effectiveTotalCount,
  ]);

  // Build cellByKey including optimistic
  const cellByKey = useMemo(() => {
    const map = new Map<string, CellData>();

    // Add cached cells
    for (const [key, cell] of state.cellCache) {
      map.set(key, cell);
    }

    // Add optimistic cells
    for (const [, optimistic] of state.optimisticRows) {
      for (const cell of optimistic.cells) {
        map.set(`${cell.rowId}:${cell.columnId}`, cell);
      }
    }

    return map;
  }, [state.cellCache, state.optimisticRows]);

  return {
    table: state.table,
    columns: state.columns,
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
    invalidateCache,
    cellByKey,
    data,
  };
}
