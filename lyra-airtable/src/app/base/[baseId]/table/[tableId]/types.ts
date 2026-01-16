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
