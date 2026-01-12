"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";

export function TableDebug() {
  const utils = api.useUtils();

  // bases to select from
  const bases = api.base.listMine.useQuery();
  const baseOptions = useMemo(() => bases.data ?? [], [bases.data]);

  const [baseId, setBaseId] = useState<string>("");

  // list tables for selected base
  const tables = api.table.listByBase.useQuery(
    { baseId },
    { enabled: !!baseId },
  );

  const [name, setName] = useState("Table 1");

  const createTable = api.table.create.useMutation({
    onSuccess: async () => {
      await utils.table.listByBase.invalidate({ baseId });
    },
  });

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <h2>Table primitives test</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label>Base:</label>
        <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
          <option value="">— select —</option>
          {baseOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {bases.isLoading ? <span>Loading bases…</span> : null}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ border: "1px solid #ccc", padding: 8, borderRadius: 6, flex: 1 }}
          placeholder="New table name"
        />
        <button
          onClick={() => createTable.mutate({ baseId, name })}
          disabled={!baseId || createTable.isPending}
          style={{ border: "1px solid #ccc", padding: 8, borderRadius: 6 }}
        >
          {createTable.isPending ? "Creating…" : "Create table"}
        </button>
      </div>

      {createTable.error ? <div>❌ {createTable.error.message}</div> : null}

      <div>
        <h3>Tables</h3>
        {!baseId ? <div>Select a base to list tables.</div> : null}
        {tables.isFetching ? <div>Loading…</div> : null}
        {tables.error ? <div>❌ {tables.error.message}</div> : null}

        {tables.data?.length ? (
          <ul>
            {tables.data.map((t) => (
              <li key={t.id}>
                {t.name} <small>({t.id})</small>
              </li>
            ))}
          </ul>
        ) : baseId && !tables.isFetching ? (
          <div>No tables yet.</div>
        ) : null}
      </div>
    </div>
  );
}