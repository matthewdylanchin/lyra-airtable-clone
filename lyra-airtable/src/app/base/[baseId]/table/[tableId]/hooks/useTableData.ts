// table/useTableData.ts
import { useMemo } from "react";
import type { TableRow } from "../types";

export function useTableData(data: any) {
  const cellByKey = useMemo(() => {
    const map = new Map<string, any>();
    if (!data) return map;
    for (const c of data.cells) {
      map.set(`${c.rowId}:${c.columnId}`, c);
    }
    return map;
  }, [data]);

  const tableData = useMemo<TableRow[]>(() => {
    if (!data) return [];

    return data.rows.map((r: any) => {
      const row: TableRow = { __rowId: r.id };

      for (const c of data.columns) {
        const cell = cellByKey.get(`${r.id}:${c.id}`);
        row[c.id] =
          c.type === "NUMBER"
            ? (cell?.numberValue ?? null)
            : (cell?.textValue ?? null);
      }

      return row;
    });
  }, [data, cellByKey]);

  return { cellByKey, tableData };
}
