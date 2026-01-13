"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/trpc/react";

export default function BaseTablesClient() {
  const params = useParams<{ baseId: string }>();
  const baseId = params.baseId;

  const utils = api.useUtils();

  const {
    data: tables = [],
    isLoading,
    error,
  } = api.table.listByBase.useQuery(
    { baseId },
    { enabled: !!baseId }, // prevents the `{}` query spam
  );

  const [name, setName] = useState("Table 1");

  const create = api.table.create.useMutation({
    onSuccess: async () => {
      await utils.table.listByBase.invalidate({ baseId });
    },
  });

  return (
    <div className="p-6">
      <div className="text-xl font-semibold">Tables</div>
      <div className="mt-4 flex items-end gap-3">
        <div>
          <div className="text-sm text-zinc-500">New table name</div>
          <input
            className="mt-1 h-9 w-[280px] rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button
          onClick={() => create.mutate({ baseId, name })}
          disabled={!name.trim() || create.isPending}
          className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {create.isPending ? "Creating..." : "Create table"}
        </button>
      </div>

      <div className="mt-6">
        {error && (
          <div className="text-sm text-red-600">{String(error.message)}</div>
        )}

        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading tables…</div>
        ) : tables.length === 0 ? (
          <div className="text-sm text-zinc-500">
            No tables yet — create your first one.
          </div>
        ) : (
          <ul className="space-y-2">
            {tables.map((t) => (
              <li key={t.id} className="rounded-md border border-zinc-200 p-3">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
