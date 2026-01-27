"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/trpc/react";
import type { SortType, FilterCondition, TableData, Cell } from "../types";

// Use the same types as the rest of the app
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

interface WindowedDataState {
  table: { id: string; name: string; baseId: string } | null;
  columns: ColumnData[];
  totalCount: number;
  rowCache: Map<number, RowData[]>;
  cellCache: Map<string, CellData>;
  loadingRanges: Set<string>;
  isInitialLoading: boolean;
  error: Error | null;
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
  addOptimisticRow: (tempId: string, atIndex?: number) => void;
  replaceOptimisticRow: (
    tempId: string,
    realRow: RowData,
    cells: CellData[],
  ) => void;
  invalidateCache: () => void;
  // For compatibility with existing code
  cellByKey: Map<string, CellData>;
  data: TableData | undefined;
}

const DEFAULT_WINDOW_SIZE = 100;
const DEFAULT_OVERSCAN = 50;

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
  });

  const activeRequests = useRef<Set<string>>(new Set());
  const optimisticRows = useRef<
    Map<string, { row: RowData; cells: CellData[] }>
  >(new Map());

  // Build query params
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

  // Fetch a window of data
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

          // Store rows at this offset
          newRowCache.set(offset, result.rows as RowData[]);

          // Store cells
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

  // Reset and fetch on query change
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
    });

    activeRequests.current.clear();
    optimisticRows.current.clear();

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

  // Get row at index - checks cache windows
  const getRowAtIndex = useCallback(
    (index: number): RowData | null => {
      // Check optimistic rows first
      for (const [, data] of optimisticRows.current) {
        if (data.row.rowIndex === index) {
          return data.row;
        }
      }

      // Find in cache
      for (const [offset, rows] of state.rowCache) {
        if (index >= offset && index < offset + rows.length) {
          return rows[index - offset] ?? null;
        }
      }

      return null;
    },
    [state.rowCache],
  );

  // Check if row is loaded
  const isRowLoaded = useCallback(
    (index: number): boolean => {
      for (const [, data] of optimisticRows.current) {
        if (data.row.rowIndex === index) {
          return true;
        }
      }

      for (const [offset, rows] of state.rowCache) {
        if (index >= offset && index < offset + rows.length) {
          return true;
        }
      }

      return false;
    },
    [state.rowCache],
  );

  // Get cell value
  const getCellValue = useCallback(
    (rowId: string, columnId: string): CellData | null => {
      const optimistic = optimisticRows.current.get(rowId);
      if (optimistic) {
        return optimistic.cells.find((c) => c.columnId === columnId) ?? null;
      }

      return state.cellCache.get(`${rowId}:${columnId}`) ?? null;
    },
    [state.cellCache],
  );

  // Load a range (called by virtualizer)
  const loadRange = useCallback(
    async (startIndex: number, endIndex: number) => {
      const totalRows = state.totalCount || 1;
      const overscanStart = Math.max(0, startIndex - overscan);
      const overscanEnd = Math.min(totalRows, endIndex + overscan);

      const windowStart = Math.floor(overscanStart / windowSize) * windowSize;
      const windowEnd = Math.ceil(overscanEnd / windowSize) * windowSize;

      const promises: Promise<void>[] = [];

      for (let offset = windowStart; offset < windowEnd; offset += windowSize) {
        const rangeKey = `${offset}-${windowSize}`;

        // Check if we need to load this window
        let needsLoad = true;

        // Check if all rows in this window are loaded
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

  // Check if range is loading
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

  // Optimistic row management
  const addOptimisticRow = useCallback(
    (tempId: string, atIndex?: number) => {
      const index = atIndex ?? state.totalCount;

      const optimisticRow: RowData = {
        id: tempId,
        rowIndex: index,
      };

      const optimisticCells: CellData[] = state.columns.map((col) => ({
        id: `temp-cell-${col.id}-${tempId}`,
        rowId: tempId,
        columnId: col.id,
        textValue: "",
        numberValue: null,
        updatedAt: new Date(),
      }));

      optimisticRows.current.set(tempId, {
        row: optimisticRow,
        cells: optimisticCells,
      });

      setState((prev) => ({
        ...prev,
        totalCount: prev.totalCount + 1,
      }));
    },
    [state.totalCount, state.columns],
  );

  const replaceOptimisticRow = useCallback(
    (tempId: string, realRow: RowData, cells: CellData[]) => {
      optimisticRows.current.delete(tempId);

      setState((prev) => {
        const newCellCache = new Map(prev.cellCache);

        // Remove temp cells
        for (const key of newCellCache.keys()) {
          if (key.startsWith(`${tempId}:`)) {
            newCellCache.delete(key);
          }
        }

        // Add real cells
        cells.forEach((cell) => {
          newCellCache.set(`${cell.rowId}:${cell.columnId}`, cell);
        });

        return {
          ...prev,
          cellCache: newCellCache,
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
    }));

    activeRequests.current.clear();

    void fetchWindow(0, windowSize);
  }, [fetchWindow, windowSize]);

  // Build compatibility data object for existing hooks
  const data = useMemo((): TableData | undefined => {
    if (!state.table || state.columns.length === 0) return undefined;

    // Collect all loaded rows in order
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

    // Collect all cells
    const allCells: CellData[] = Array.from(state.cellCache.values());

    return {
      table: state.table,
      columns: state.columns,
      rows: allRows,
      cells: allCells,
      totalCount: state.totalCount,
      nextCursor: undefined,
    };
  }, [
    state.table,
    state.columns,
    state.rowCache,
    state.cellCache,
    state.totalCount,
  ]);

  return {
    table: state.table,
    columns: state.columns,
    totalCount: state.totalCount + optimisticRows.current.size,
    getRowAtIndex,
    getCellValue,
    isRowLoaded,
    loadRange,
    isInitialLoading: state.isInitialLoading,
    isLoadingRange,
    error: state.error,
    addOptimisticRow,
    replaceOptimisticRow,
    invalidateCache,
    cellByKey: state.cellCache,
    data,
  };
}
