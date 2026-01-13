"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function TableClient() {
  const params = useParams<{ tableId?: string }>();
  const tableId = params.tableId;

  const q = api.table.getData.useQuery(
    { tableId: tableId ?? "", limit: 50 },
    { enabled: !!tableId },
  );

  const data = q.data;

  // optional: speed up cell lookup
  type TableData = NonNullable<typeof q.data>;
  type Cell = TableData["cells"][number];

  const cellMap = useMemo(() => {
    const m = new Map<string, Cell>();

    const cells = (q.data?.cells ?? []) as Cell[];
    for (const cell of cells) {
      m.set(`${cell.rowId}:${cell.columnId}`, cell);
    }

    return m;
  }, [q.data]);

  if (!tableId) return null;
  if (q.isLoading) return <div className="p-6">Loading…</div>;
  if (q.error) return <div className="p-6">{q.error.message}</div>;
  if (!data) return <div className="p-6">No data</div>;

  return (
    <div className="p-6">
      <div className="text-lg font-semibold">{data.table.name}</div>

      <div className="mt-4 rounded-md border border-zinc-200">
        <div className="grid grid-cols-[120px_repeat(auto-fit,minmax(160px,1fr))] border-b bg-zinc-50 text-sm font-medium">
          <div className="p-2 text-zinc-500">#</div>
          {data.columns.map((c) => (
            <div key={c.id} className="p-2">
              {c.name}
            </div>
          ))}
        </div>

        {data.rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[120px_repeat(auto-fit,minmax(160px,1fr))] border-b text-sm"
          >
            <div className="p-2 text-zinc-500">{r.rowIndex + 1}</div>

            {data.columns.map((c) => {
              const cell = cellMap.get(`${r.id}:${c.id}`);
              const value =
                c.type === "NUMBER"
                  ? (cell?.numberValue ?? "")
                  : (cell?.textValue ?? "");

              return (
                <div key={c.id} className="p-2">
                  {String(value)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
