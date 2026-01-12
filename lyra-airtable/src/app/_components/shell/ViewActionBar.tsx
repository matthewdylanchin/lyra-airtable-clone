import { ChevronDown, Filter, EyeOff, Search, SlidersHorizontal } from "lucide-react";

export default function ViewActionBar() {
  return (
    <div className="h-[44px] border-b border-zinc-200 bg-white">
      <div className="flex h-full items-center gap-2 px-3">
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-zinc-100">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-600">
            ▦
          </span>
          Grid view <ChevronDown className="h-4 w-4 text-zinc-500" />
        </button>

        <div className="ml-auto flex items-center gap-1 text-sm text-zinc-700">
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <EyeOff className="h-4 w-4 text-zinc-500" /> Hide fields
          </button>
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <Filter className="h-4 w-4 text-zinc-500" /> Filter
          </button>
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <SlidersHorizontal className="h-4 w-4 text-zinc-500" /> Sort
          </button>

          <div className="relative ml-2">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              placeholder=""
              className="h-8 w-8 rounded-md border border-transparent bg-transparent pl-8 pr-2 text-sm text-zinc-700 placeholder:text-zinc-400 hover:bg-zinc-50 focus:w-64 focus:border-zinc-200 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}