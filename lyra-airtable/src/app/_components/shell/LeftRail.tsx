"use client";
import { Plus, Search, Sheet, Ellipsis, GripVertical } from "lucide-react";

export default function LeftRail() {
  return (
    <div className="w-[280px] border-r border-zinc-200 bg-white">
      <div className="p-3">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100">
          <Plus className="h-4 w-4 text-zinc-500" />
          <span className="font-medium">Create new...</span>
        </button>

        <div className="relative mt-2">
          <Search className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            placeholder="Find a view"
            className="w-full rounded-md border border-transparent bg-white py-1.5 pr-2 pl-8 text-sm outline-none focus:border-blue-600"
          />
        </div>
      </div>

      <div className="px-2">
        {/* OUTER is now a div, not a button (prevents nested button issue) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            // TODO: select view
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              // TODO: select view
            }
          }}
          className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100"
        >
          {/* Left: icon + label */}
          <div className="flex items-center gap-2">
            <Sheet className="h-4 w-4 text-blue-600" />
            <span>Grid view</span>
          </div>

          {/* Right: hover actions */}
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="rounded p-1 hover:bg-zinc-200"
              aria-label="View options"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: open view options menu
              }}
            >
              <Ellipsis className="h-4 w-4 text-zinc-500" />
            </button>

            <button
              type="button"
              className="cursor-grab rounded p-1 hover:bg-zinc-200"
              aria-label="Reorder view"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
