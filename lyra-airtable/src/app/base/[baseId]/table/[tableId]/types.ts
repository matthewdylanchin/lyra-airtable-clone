import type { RouterOutputs, RouterInputs } from "@/trpc/react";
import type { UseMutationResult } from "@tanstack/react-query";

export type TableData = RouterOutputs["table"]["getData"];

export type Column = TableData["columns"][number];
export type Row = TableData["rows"][number];
export type Cell = TableData["cells"][number];

export type CellValue = string | number | null;

export type TableRow = {
  __rowId: string;
} & Record<string, CellValue>;

export type Editing = {
  rowId: string;
  columnId: string;
  originalValue: string; // ← Add this
} | null;

export type SelectedCell = {
  rowIndex: number;
  colIndex: number;
} | null;

export type CellUpsertInput = RouterInputs["cell"]["upsertValue"];

export type CellUpsertOutput = RouterOutputs["cell"]["upsertValue"];

export type CellUpsertMutation = UseMutationResult<
  CellUpsertOutput,
  unknown,
  CellUpsertInput,
  unknown
>;

export type ColumnMeta = {
  id: string;
  name: string;
  type: string; // "TEXT" | "NUMBER"
};

export type ColumnInsertPosition =
  | { type: "end" }
  | { type: "before"; columnId: string }
  | { type: "after"; columnId: string };

export type AddColumnState = {
  insert: ColumnInsertPosition;
  position: { top: number; left: number }; // Position below chevron
} | null;

export type FilterOperator =
  // Text operators
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "empty"
  | "not_empty"
  // Number operators
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface FilterCondition {
  id: string;
  columnId: string;
  operator: FilterOperator; // ✅ Specific type
  value?: string;
}

export type FilterGroup = {
  id: string;
  type: "group";
  conjunction: "and" | "or";
  conditions: Array<FilterCondition | FilterGroup>; // ✅ Recursive: can contain conditions or more groups
};

export type FilterConfig = {
  rootConjunction: "and" | "or";
  conditions: Array<FilterCondition | FilterGroup>;
};

// Helper to check if something is a group
export function isFilterGroup(
  item: FilterCondition | FilterGroup,
): item is FilterGroup {
  return (item as FilterGroup).type === "group";
}



// Helper to get all column IDs that are filtered (for badges)
export function getFilteredColumnIds(
  conditions: Array<FilterCondition | FilterGroup>,
): Set<string> {
  const columnIds = new Set<string>();

  conditions.forEach((item) => {
    if (isFilterGroup(item)) {
      // Recursively get column IDs from nested groups
      const nestedIds = getFilteredColumnIds(item.conditions);
      nestedIds.forEach((id) => columnIds.add(id));
    } else {
      columnIds.add(item.columnId);
    }
  });

  return columnIds;
}

export type SortType = { id: string; columnId: string; direction: "asc" | "desc" };