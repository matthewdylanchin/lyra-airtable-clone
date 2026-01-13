"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function TableClient() {
  const params = useParams<{ baseId: string; tableId: string }>();
  const tableId = params.tableId;

  const { data, isLoading, error } = api.table.getData.useQuery(
    { tableId, limit: 50 },
    { enabled: !!tableId },
  );

  if (isLoading)
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  if (error)
    return <div className="p-6 text-sm text-red-600">{error.message}</div>;
  if (!data) return null;

  return (
    <div className="p-6">
      <div className="text-lg font-semibold">{data.table.name}</div>

      <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
        <div className="grid grid-cols-[60px_repeat(auto-fit,minmax(160px,1fr))] border-b bg-zinc-50 text-sm font-medium">
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
            className="grid grid-cols-[60px_repeat(auto-fit,minmax(160px,1fr))] border-b text-sm"
          >
            <div className="p-2 text-zinc-500">{r.rowIndex + 1}</div>

            {data.columns.map((c) => {
              const cell = data.cells.find(
                (x) => x.rowId === r.id && x.columnId === c.id,
              );
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
