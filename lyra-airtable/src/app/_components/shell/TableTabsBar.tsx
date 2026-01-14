"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { api } from "@/trpc/react";
import AddOrImportMenu from "./AddOrImportMenu";

export default function TableTabsBar() {
  const params = useParams<{ baseId?: string; tableId?: string }>();
  const baseId = params.baseId;
  const activeTableId = params.tableId;

  // If we’re not inside /base/[baseId] routes, keep your static bar (or render nothing)
  if (!baseId) {
    return (
      <div className="relative h-[35px] border-b border-zinc-200 bg-violet-50" />
    );
  }

  const { data: tables, isLoading } = api.table.listByBase.useQuery(
    { baseId },
    { enabled: !!baseId },
  );

  return (
    <div className="relative h-[35px] overflow-visible border-b border-zinc-200 bg-violet-50">
      <div className="flex h-full items-end gap-2 pr-3 pl-1">
        {/* Tabs */}
        <div className="flex items-end gap-2">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
          ) : (
            (tables ?? []).map((t) => {
              const isActive = t.id === activeTableId;

              // “Active pill” styling vs inactive tabs
              const base =
                "flex items-center gap-1 px-3 py-2.5 text-sm font-semibold";
              const active =
                "relative z-50 -mb-[6px] rounded-l-none rounded-r-[10px] bg-white text-zinc-900 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[2px] after:bg-white after:content-['']";
              const inactive =
                "rounded-md bg-transparent text-zinc-700 hover:bg-white/60";

              return (
                <Link
                  key={t.id}
                  href={`/base/${baseId}/table/${t.id}`}
                  className={`${base} ${isActive ? active : inactive}`}
                >
                  <span>{t.name}</span>
                  {isActive && (
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  )}
                </Link>
              );
            })
          )}
        </div>

        {/* Add / import (keep as-is for now) */}
        <AddOrImportMenu baseId={baseId} />

        <div className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
          <button className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/60">
            <span>Tools</span>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
