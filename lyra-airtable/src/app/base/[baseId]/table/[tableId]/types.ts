// table/types.ts

export type Editing = {
  rowId: string;
  columnId: string;
} | null;

export type SelectedCell = {
  rowIndex: number;
  colIndex: number;
} | null;

export type CellValue = string | number | null;

export type TableRow = {
  __rowId: string;
} & Record<string, CellValue>;
