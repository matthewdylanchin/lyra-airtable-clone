"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

type Editing = { rowId: string; columnId: string } | null;

export default function TableClient() {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const utils = api.useUtils();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const q = api.table.getData.useQuery(
    { tableId, limit: 50 },
    { enabled: !!tableId },
  );

  type TableData = NonNullable<typeof q.data>;
  type Cell = TableData["cells"][number];
  type Row = TableData["rows"][number];
  type Column = TableData["columns"][number];

  const upsert = api.cell.upsertValue.useMutation({
    onSuccess: async () => {
      await utils.table.getData.invalidate({ tableId, limit: 50 });
    },
  });

  const data = q.data;

  const cellByKey = useMemo(() => {
    const map = new Map<string, Cell>();
    if (!data) return map;
    for (const c of data.cells) map.set(`${c.rowId}:${c.columnId}`, c);
    return map;
  }, [data]);

  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!hydrated) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }

  if (q.isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  
  if (q.error)
    return <div className="p-6 text-sm text-red-600">{q.error.message}</div>;
  if (!data) return <div className="p-6">No data</div>;
  const startEdit = (rowId: string, columnId: string) => {
    setLocalError(null);
    const cell = cellByKey.get(`${rowId}:${columnId}`);
    const col = data.columns.find((c: Column) => c.id === columnId);

    const value =
      col?.type === "NUMBER"
        ? (cell?.numberValue ?? "")
        : (cell?.textValue ?? "");

    setDraft(String(value));
    setEditing({ rowId, columnId });
  };

  const cancelEdit = () => {
    setLocalError(null);
    setEditing(null);
    setDraft("");
  };

  const commitEdit = async () => {
    if (!editing) return;

    setLocalError(null);

    try {
      await upsert.mutateAsync({
        rowId: editing.rowId,
        columnId: editing.columnId,
        value: draft,
      });
      setEditing(null);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setLocalError(e.message);
      } else {
        setLocalError("Failed to save");
      }
    }
  };

  return (
    <div className="p-6">
      <div className="text-lg font-semibold">{data.table.name}</div>

      {(localError ?? upsert.error) && (
        <div className="mt-2 text-sm text-red-600">
          {localError ?? upsert.error?.message}
        </div>
      )}

      <div className="mt-4 rounded-md border border-zinc-200">
        {/* header */}
        <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(220px,1fr))] border-b bg-zinc-50 text-sm font-medium">
          <div className="p-2 text-zinc-500">#</div>
          {data.columns.map((c: Column) => (
            <div key={c.id} className="p-2">
              {c.name}
            </div>
          ))}
        </div>

        {/* rows */}
        {data.rows.map((r: Row) => (
          <div
            key={r.id}
            className="grid grid-cols-[80px_repeat(auto-fit,minmax(220px,1fr))] border-b text-sm"
          >
            <div className="p-2 text-zinc-500">{r.rowIndex + 1}</div>

            {data.columns.map((c: Column) => {
              const key = `${r.id}:${c.id}`;
              const cell = cellByKey.get(key);

              const value =
                c.type === "NUMBER"
                  ? (cell?.numberValue ?? "")
                  : (cell?.textValue ?? "");

              const isEditing =
                editing?.rowId === r.id && editing?.columnId === c.id;

              return (
                <div
                  key={c.id}
                  className="p-2"
                  onClick={() => !isEditing && startEdit(r.id, c.id)}
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
                    <div className="h-8 w-full rounded-md px-2 py-1 hover:bg-zinc-50">
                      {String(value)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
