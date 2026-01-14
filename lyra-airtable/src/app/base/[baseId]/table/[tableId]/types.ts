import type { RouterOutputs } from "@/trpc/react";

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
