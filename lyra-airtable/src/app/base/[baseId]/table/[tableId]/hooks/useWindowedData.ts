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
  cellValues: Map<string, CellData>;
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
  optimisticRows: Map<string, OptimisticRow>;
  optimisticColumns: Map<string, OptimisticColumn>;
  pendingCellEdits: Map<string, PendingCellEdit>;
  deletedRowIds: Set<string>;
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
  addOptimisticRow: (tempId: string) => void;
  insertOptimisticRow: (tempId: string, atIndex: number) => void;
  removeOptimisticRow: (tempId: string) => void;
  replaceOptimisticRowId: (tempId: string, realId: string) => void;
  deleteRowOptimistically: (rowId: string) => void;
  addOptimisticColumn: (column: {
    id: string;
    name: string;
    type: ColumnType;
    order: number;
  }) => void;
  removeOptimisticColumn: (tempId: string) => void;
  replaceOptimisticColumnId: (tempId: string, realId: string) => void;
  setPendingCellEdit: (
    rowId: string,
    columnId: string,
    textValue: string | null,
    numberValue: number | null,
  ) => void;
  clearPendingCellEdit: (
    rowId: string,
    columnId: string,
    newValue?: { textValue: string | null; numberValue: number | null },
  ) => void;
  invalidateCache: () => void;
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

  // ✅ Keep ref for instant synchronous reads during commit
  const pendingCellEditsRef = useRef<Map<string, PendingCellEdit>>(new Map());

  const activeRequests = useRef<Set<string>>(new Set());
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

          const filteredRows = result.rows.filter((row) => {
            for (const opt of prev.optimisticRows.values()) {
              if (opt.row.id === row.id) return false;
            }
            return !prev.deletedRowIds.has(row.id);
          });

          newRowCache.set(offset, filteredRows);

          result.cells.forEach((cell) => {
            const cellKey = `${cell.rowId}:${cell.columnId}`;

            if (pendingCellEditsRef.current.has(cellKey)) {
              return;
            }

            if (prev.deletedRowIds.has(cell.rowId)) {
              return;
            }

            newCellCache.set(cellKey, cell as CellData);
          });

          const newOptimisticColumns = new Map(prev.optimisticColumns);
          const serverColumnIds = new Set(result.columns.map((c) => c.id));

          for (const [tempId, optCol] of prev.optimisticColumns) {
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

  useEffect(() => {
    queryChangeInProgress.current = true;

    setState((prev) => ({
      ...prev,
      table: null,
      columns: [],
      totalCount: prev.totalCount,
      rowCache: prev.rowCache,
      cellCache: prev.cellCache,
      loadingRanges: new Set(),
      isInitialLoading: true,
      error: null,
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

  const allColumns = useMemo(() => {
    const serverColumns = [...state.columns];
    const optimisticCols = Array.from(state.optimisticColumns.values()).map(
      (opt) => opt.column,
    );

    const merged = [...serverColumns, ...optimisticCols];
    merged.sort((a, b) => a.order - b.order);

    return merged;
  }, [state.columns, state.optimisticColumns]);

  const effectiveTotalCount = useMemo(() => {
    return (
      state.totalCount + state.optimisticRows.size - state.deletedRowIds.size
    );
  }, [state.totalCount, state.optimisticRows.size, state.deletedRowIds.size]);

  const getRowAtIndex = useCallback(
    (index: number): RowData | null => {
      const serverRowCount = state.totalCount;

      if (index >= serverRowCount) {
        const optimisticIndex = index - serverRowCount;
        const optimisticRows = Array.from(state.optimisticRows.values());
        return optimisticRows[optimisticIndex]?.row ?? null;
      }

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

  const isRowLoaded = useCallback(
    (index: number): boolean => {
      return getRowAtIndex(index) !== null;
    },
    [getRowAtIndex],
  );

  // ✅ Check ref first for instant reads, but include state.pendingCellEdits in deps to trigger re-renders
  const getCellValue = useCallback(
    (rowId: string, columnId: string): CellData | null => {
      const cellKey = `${rowId}:${columnId}`;

      // 1. Check pending edits (use state for re-renders, but ref gives us instant access)
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

      // 3. Check optimistic columns
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
      state.pendingCellEdits, // ✅ Include this to trigger re-renders when pending edits change
    ],
  );

  const loadRange = useCallback(
    async (startIndex: number, endIndex: number) => {
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

      return {
        ...prev,
        optimisticRows: newOptimisticRows,
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
      };
    });
  }, []);

  const replaceOptimisticRowId = useCallback(
    (tempId: string, realId: string) => {
      setState((prev) => {
        const optimisticRow = prev.optimisticRows.get(tempId);
        if (!optimisticRow) return prev;

        const newOptimisticRows = new Map(prev.optimisticRows);

        const updatedCells = optimisticRow.cells.map((cell) => ({
          ...cell,
          rowId: realId,
          id: `${realId}-${cell.columnId}`,
        }));

        newOptimisticRows.set(tempId, {
          row: { ...optimisticRow.row, id: realId },
          cells: updatedCells,
        });

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

        // ✅ Sync ref
        pendingCellEditsRef.current = newPendingCellEdits;

        return {
          ...prev,
          optimisticRows: newOptimisticRows,
          pendingCellEdits: newPendingCellEdits,
        };
      });
    },
    [],
  );

  const deleteRowOptimistically = useCallback((rowId: string) => {
    setState((prev) => {
      if (prev.optimisticRows.has(rowId)) {
        const newOptimisticRows = new Map(prev.optimisticRows);
        newOptimisticRows.delete(rowId);
        return {
          ...prev,
          optimisticRows: newOptimisticRows,
        };
      }

      const newDeletedRowIds = new Set(prev.deletedRowIds);
      newDeletedRowIds.add(rowId);

      return {
        ...prev,
        deletedRowIds: newDeletedRowIds,
      };
    });
  }, []);

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

        const newOptimisticColumns = new Map(prev.optimisticColumns);

        const updatedColumn: ColumnData = {
          ...optimisticColumn.column,
          id: realId,
        };

        const updatedCellValues = new Map<string, CellData>();

        for (const [rowId, cell] of optimisticColumn.cellValues) {
          const updatedCell: CellData = {
            ...cell,
            columnId: realId,
            id: `${rowId}-${realId}`,
          };
          updatedCellValues.set(rowId, updatedCell);
        }

        newOptimisticColumns.set(tempId, {
          column: updatedColumn,
          cellValues: updatedCellValues,
        });

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

        // ✅ Sync ref
        pendingCellEditsRef.current = newPendingCellEdits;

        return {
          ...prev,
          optimisticColumns: newOptimisticColumns,
          pendingCellEdits: newPendingCellEdits,
        };
      });
    },
    [],
  );

  // ✅ Update both ref AND state to trigger re-renders
  const setPendingCellEdit = useCallback(
    (
      rowId: string,
      columnId: string,
      textValue: string | null,
      numberValue: number | null,
    ) => {
      const cellKey = `${rowId}:${columnId}`;

      const editData = {
        rowId,
        columnId,
        textValue,
        numberValue,
        timestamp: Date.now(),
      };

      // Update ref for instant synchronous access
      pendingCellEditsRef.current.set(cellKey, editData);

      // Update state to trigger re-render
      setState((prev) => {
        const newPendingCellEdits = new Map(prev.pendingCellEdits);
        newPendingCellEdits.set(cellKey, editData);

        return {
          ...prev,
          pendingCellEdits: newPendingCellEdits,
        };
      });
    },
    [],
  );

  // ✅ Update both ref AND state
  const clearPendingCellEdit = useCallback(
    (
      rowId: string,
      columnId: string,
      newValue?: { textValue: string | null; numberValue: number | null },
    ) => {
      const cellKey = `${rowId}:${columnId}`;

      // Update ref for instant synchronous access
      pendingCellEditsRef.current.delete(cellKey);

      setState((prev) => {
        const newPendingCellEdits = new Map(prev.pendingCellEdits);
        newPendingCellEdits.delete(cellKey);

        const newCellCache = new Map(prev.cellCache);
        if (newValue) {
          const existingCell = prev.cellCache.get(cellKey);
          newCellCache.set(cellKey, {
            id: existingCell?.id ?? `${rowId}-${columnId}`,
            rowId,
            columnId,
            textValue: newValue.textValue,
            numberValue: newValue.numberValue,
            updatedAt: new Date(),
          });
        }

        return {
          ...prev,
          pendingCellEdits: newPendingCellEdits,
          cellCache: newValue ? newCellCache : prev.cellCache,
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
      deletedRowIds: new Set(),
    }));

    activeRequests.current.clear();

    void fetchWindow(0, windowSize);
  }, [fetchWindow, windowSize]);

  const data = useMemo((): TableData | undefined => {
    if (!state.table || allColumns.length === 0) return undefined;

    const allRows: RowData[] = [];
    const sortedOffsets = Array.from(state.rowCache.keys()).sort(
      (a, b) => a - b,
    );

    for (const offset of sortedOffsets) {
      const rows = state.rowCache.get(offset);
      if (rows) {
        allRows.push(...rows.filter((r) => !state.deletedRowIds.has(r.id)));
      }
    }

    for (const [, optimistic] of state.optimisticRows) {
      allRows.push(optimistic.row);
    }

    const allCells: CellData[] = [];

    for (const [key, cell] of state.cellCache) {
      if (
        !state.pendingCellEdits.has(key) &&
        !state.deletedRowIds.has(cell.rowId)
      ) {
        allCells.push(cell);
      }
    }

    for (const [, optimistic] of state.optimisticRows) {
      allCells.push(...optimistic.cells);
    }

    for (const [, optimisticCol] of state.optimisticColumns) {
      allCells.push(...optimisticCol.cellValues.values());
    }

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

  const cellByKey = useMemo(() => {
    const map = new Map<string, CellData>();

    for (const [key, cell] of state.cellCache) {
      if (!state.deletedRowIds.has(cell.rowId)) {
        map.set(key, cell);
      }
    }

    for (const [, optimistic] of state.optimisticRows) {
      for (const cell of optimistic.cells) {
        map.set(`${cell.rowId}:${cell.columnId}`, cell);
      }
    }

    for (const [, optimisticCol] of state.optimisticColumns) {
      for (const [rowId, cell] of optimisticCol.cellValues) {
        map.set(`${rowId}:${cell.columnId}`, cell);
      }
    }

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
