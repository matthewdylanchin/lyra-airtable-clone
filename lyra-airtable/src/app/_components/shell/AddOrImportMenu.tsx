"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/trpc/react";

export default function AddOrImportMenu({ baseId }: { baseId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Table 1");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const utils = api.useUtils();

  const create = api.table.create.useMutation({
    onSuccess: async () => {
      setOpen(false);
      setNameError(null);
      // ...
    },
    onError: (err) => {
      // Show inline bubble for duplicate name
      if (err.data?.code === "CONFLICT") {
        setNameError(err.message); // "Please enter a unique table name"
        return;
      }
      // fallback for unexpected errors
      setNameError("Something went wrong");
    },
  });

  const [nameError, setNameError] = useState<string | null>(null);

  // optional: auto-suggest Table N based on current tables count
  const { data: tables = [] } = api.table.listByBase.useQuery(
    { baseId },
    { enabled: !!baseId },
  );
  const nextDefaultName = useMemo(() => `Table ${tables.length + 1}`, [tables]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setName(nextDefaultName);
        }}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-white/60"
      >
        <Plus className="h-4 w-4" />
        Add or import
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute top-[calc(100%+6px)] left-0 z-50 w-[320px] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg"
        >
          <div className="text-xs font-semibold text-zinc-700">
            Create new table
          </div>

          <div className="relative mt-2">
            <label className="text-xs text-zinc-500">Table name</label>
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-600"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
            />

            {nameError && (
              <div className="absolute top-[64px] left-2 z-50">
                {/* little red triangle */}
                <div className="ml-4 h-0 w-0 border-r-[8px] border-b-[8px] border-l-[8px] border-r-transparent border-b-rose-300 border-l-transparent" />
                {/* bubble */}
                <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-sm">
                  {nameError}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-md px-3 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={create.isPending || name.trim().length === 0}
              onClick={() => create.mutate({ baseId, name: name.trim() })}
              className="h-9 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              className="w-full rounded-md px-2 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
              onClick={() => {
                // placeholder for later
                alert("Import coming soon");
              }}
            >
              Import data (CSV) — coming soon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}