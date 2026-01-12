import {
  ChevronDown,
  Filter,
  EyeOff,
  Search,
  SlidersHorizontal,
  Layers,
  ArrowDownUp,
  PaintBucket,
  Rows3,
  ExternalLink,
} from "lucide-react";

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

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-1 text-sm text-zinc-700">
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <EyeOff className="h-4 w-4 text-zinc-500" /> Hide fields
          </button>

          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-100">
            <Filter className="h-4 w-4 text-zinc-500" /> Filter
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

          {/* Search icon/button on far right */}
          <button
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
