"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { api } from "@/trpc/react";
import AddOrImportMenu from "./AddOrImportMenu";

export default function TableTabsBar() {
  const params = useParams<{ baseId?: string; tableId?: string }>();
  const baseId = params.baseId;
  const activeTableId = params.tableId;

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
      <div className="flex h-full items-center gap-2 pr-3">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
          ) : (
            (tables ?? []).map((t, index) => {
              const isActive = t.id === activeTableId;
              const isFirst = index === 0;

              // Different padding for active vs inactive
              const base = "flex items-center gap-1 px-3 text-sm font-semibold";

              // Active tab: extra bottom padding to cover the border
              const active = `${base} py-1.5 pb-[calc(0.375rem+2px)] relative z-50 bg-white text-zinc-900 border-t border-x border-t-zinc-200 border-x-zinc-200 mb-[-2px] ${
                isFirst ? "rounded-tr-[4px]" : "rounded-t-[4px]"
              }`;

              const inactive = `${base} py-1.5 rounded-md bg-transparent text-zinc-700 hover:bg-white/60`;

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
