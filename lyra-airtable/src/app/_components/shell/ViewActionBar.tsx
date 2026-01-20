"use client";

import { useRef, useEffect } from "react";
import {
  ChevronDown,
  Filter,
  EyeOff,
  Search,
  Layers,
  ArrowDownUp,
  PaintBucket,
  Rows3,
  ExternalLink,
  Sheet,
  Menu,
} from "lucide-react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { useTableView } from "@/app/base/[baseId]/table/[tableId]/TableViewContext";
import { useState } from "react";

export default function ViewActionBar() {
  const { tableId } = useParams<{ tableId: string }>();
  const utils = api.useUtils();
  const {
    setSearchBarOpen,
    setSearchButtonRef,
    setFilterPanelOpen,
    setFilterButtonRef,
  } = useTableView();
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Set the ref in context when component mounts
  useEffect(() => {
    setSearchButtonRef(searchButtonRef);
    setFilterButtonRef(filterButtonRef);
  }, [setSearchButtonRef, setFilterButtonRef]);

  const seedRows = api.row.seedMany.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
    },
  });

  const handleSeed = () => {
    if (seedRows.isPending) return;
    if (!confirm("Add 100,000 fake rows to this table?")) return;
    seedRows.mutate({ tableId, count: 100_000 });
  };

  return (
    <div className="h-[44px] border-b border-zinc-200 bg-white">
      <div className="flex h-full items-center gap-2 px-3">
        <button
          className="rounded-md p-2 hover:bg-zinc-100"
          aria-label="Toggle views sidebar"
        >
          <Menu className="h-5 w-5 text-zinc-700" />
        </button>

        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-zinc-100">
          <Sheet className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-600" />
          Grid view <ChevronDown className="h-4 w-4 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={handleSeed}
          className="ml-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={seedRows.isPending}
        >
          {seedRows.isPending ? "Adding…" : "Add 100k rows"}
        </button>

        <div className="ml-auto flex items-center gap-1 text-sm text-zinc-700">
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <EyeOff className="h-4 w-4 text-zinc-500" /> Hide fields
          </button>

          <button
            ref={filterButtonRef}
            onClick={() => setFilterPanelOpen(true)}
            className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            <Filter className="h-4 w-4 text-zinc-500" />
            Filter
          </button>

          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <Layers className="h-4 w-4 text-zinc-500" /> Group
          </button>

          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <ArrowDownUp className="h-4 w-4 text-zinc-500" /> Sort
          </button>

          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <PaintBucket className="h-4 w-4 text-zinc-500" /> Color
          </button>

          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <Rows3 className="h-4 w-4 text-zinc-500" />
          </button>

          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <ExternalLink className="h-4 w-4 text-zinc-500" /> Share and sync
          </button>

          {/* Search button with ref */}
          <button
            ref={searchButtonRef}
            onClick={() => setSearchBarOpen(true)}
            className="ml-1 rounded-md px-2 py-1.5 hover:bg-zinc-100"
            aria-label="Search"
          >
            <Search className="h-4 w-4 text-zinc-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
