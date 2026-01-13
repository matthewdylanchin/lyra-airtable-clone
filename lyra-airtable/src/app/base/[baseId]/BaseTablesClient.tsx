"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/trpc/react";

export default function BaseTablesClient() {
  const params = useParams<{ baseId: string }>();
  const baseId = params.baseId;

  const utils = api.useUtils();
  const {
    data: tables,
    isLoading,
    error,
  } = api.table.listByBase.useQuery({ baseId });

  const [name, setName] = useState("Table 1");
  const create = api.table.create.useMutation({
    onSuccess: async () => {
      setName("Table 1");
      await utils.table.listByBase.invalidate({ baseId });
    },
  });

  if (error)
    return <div className="p-6 text-sm text-red-600">{error.message}</div>;

  return (
    <div className="p-6">
      <div className="text-xl font-semibold">Tables</div>

      <div className="mt-3 flex items-end gap-3">
        <div className="w-[320px]">
          <div className="text-sm text-zinc-500">New table name</div>
          <input
            className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button
          onClick={() => create.mutate({ baseId, name })}
          disabled={create.isPending}
          className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {create.isPending ? "Creating..." : "Create table"}
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && (
          <div className="text-sm text-zinc-500">Loading tables…</div>
        )}

        {(tables ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/base/${baseId}/table/${t.id}`}
            className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50"
          >
            <div className="text-sm font-semibold">{t.name}</div>
            <div className="text-xs text-zinc-500">{t.id}</div>
          </Link>
        ))}

        {!isLoading && (tables?.length ?? 0) === 0 && (
          <div className="text-sm text-zinc-500">
            No tables yet — create your first one.
          </div>
        )}
      </div>
    </div>
  );
}
