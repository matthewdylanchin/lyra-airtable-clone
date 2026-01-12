"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function CreateBaseDebug() {
  const [name, setName] = useState("My first base");
  const createBase = api.base.create.useMutation();

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ border: "1px solid #ccc", padding: 8, borderRadius: 6 }}
      />
      <button
        onClick={() => createBase.mutate({ name })}
        disabled={createBase.isPending}
        style={{ border: "1px solid #ccc", padding: 8, borderRadius: 6 }}
      >
        {createBase.isPending ? "Creating..." : "Create base"}
      </button>

      {createBase.data?.id ? <span>✅ {createBase.data.id}</span> : null}
      {createBase.error ? <span>❌ {createBase.error.message}</span> : null}
    </div>
  );
}