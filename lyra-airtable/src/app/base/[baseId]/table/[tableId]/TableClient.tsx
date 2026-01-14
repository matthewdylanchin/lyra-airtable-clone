"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
} from "@tanstack/react-table";
import { api } from "@/trpc/react";
import type { Table } from "generated/prisma";

type Editing = { rowId: string; columnId: string } | null;

export default function TableClient() {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const utils = api.useUtils();

  const q = api.table.getData.useQuery(
    { tableId, limit: 50 },
    { enabled: !!tableId },
  );

  const upsert = api.cell.upsertValue.useMutation({
    onSuccess: async () => {
      await utils.table.getData.invalidate({ tableId, limit: 50 });
    },
  });

  const data = q.data;

  /** ---------- Types derived from API ---------- */
  type TableData = NonNullable<typeof data>;
  type Column = TableData["columns"][number];
  type Row = TableData["rows"][number];
  type Cell = TableData["cells"][number];
  type CellValue = string | number | null;

  type TableRow = {
    __rowId: string;
  } & Record<string, CellValue>;

  /** ---------- Build fast lookup for cells ---------- */
  const cellByKey = useMemo(() => {
    const map = new Map<string, Cell>();
    if (!data) return map;
    for (const c of data.cells) {
      map.set(`${c.rowId}:${c.columnId}`, c);
    }
    return map;
  }, [data]);

  /** ---------- Editing state ---------- */
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const startEdit = (rowId: string, columnId: string) => {
    setLocalError(null);

    const cell = cellByKey.get(`${rowId}:${columnId}`);
    const col = data?.columns.find((c) => c.id === columnId);

    const value =
      col?.type === "NUMBER"
        ? (cell?.numberValue ?? "")
        : (cell?.textValue ?? "");

    setDraft(String(value));
    setEditing({ rowId, columnId });
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
    setLocalError(null);
  };

  const commitEdit = async () => {
    if (!editing) return;

    try {
      await upsert.mutateAsync({
        rowId: editing.rowId,
        columnId: editing.columnId,
        value: draft,
      });
      setEditing(null);
    } catch (e: unknown) {
      if (e instanceof Error) setLocalError(e.message);
      else setLocalError("Failed to save");
    }
  };

  /** ---------- Derive table rows for TanStack ---------- */
  const tableData = useMemo<TableRow[]>(() => {
    if (!data) return [];

    return data.rows.map((r: Row): TableRow => {
      const row: TableRow = {
        __rowId: r.id,
      };

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

  /** ---------- Define TanStack columns ---------- */
  const columnDefs = useMemo<ColumnDef<TableRow, CellValue>[]>(() => {
    if (!data) return [];

    return [
      {
        id: "__index",
        header: "#",
        cell: (info) => info.row.index + 1,
      },

      ...data.columns.map(
        (c): ColumnDef<TableRow, CellValue> => ({
          id: c.id,
          header: c.name,

          accessorFn: (row: TableRow): CellValue => row[c.id] ?? null,

          cell: (info: CellContext<TableRow, CellValue>) => {
            const value = info.getValue();
            const rowId = info.row.original.__rowId;

            const isEditing =
              editing?.rowId === rowId && editing?.columnId === c.id;

            return (
              <div
                className="h-8 w-full px-2 py-1 hover:bg-zinc-50"
                onClick={() => !isEditing && startEdit(rowId, c.id)}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => void commitEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="h-8 w-full rounded-md border border-blue-600 px-2 outline-none"
                  />
                ) : (
                  String(value ?? "")
                )}
              </div>
            );
          },
        }),
      ),
    ];
  }, [data, editing, draft]);

  /** ---------- Create TanStack table ---------- */
  const table = useReactTable({
    data: tableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
  });

  /** ---------- Loading / error ---------- */
  if (q.isLoading) return <div className="p-6">Loading…</div>;
  if (q.error)
    return <div className="p-6 text-sm text-red-600">{q.error.message}</div>;
  if (!data) return <div className="p-6">No data</div>;

  /** ---------- Render ---------- */
  return (
    <div className="p-6">
      <div className="text-lg font-semibold">{data.table.name}</div>

      {(localError ?? upsert.error) && (
        <div className="mt-2 text-sm text-red-600">
          {localError ?? upsert.error?.message}
        </div>
      )}

      <div className="mt-4 overflow-auto rounded-md border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b px-2 py-2 text-left font-medium"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
