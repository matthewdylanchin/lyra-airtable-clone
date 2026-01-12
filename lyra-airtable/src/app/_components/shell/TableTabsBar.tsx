import { ChevronDown, Plus } from "lucide-react";

export default function TableTabsBar() {
  return (
    <div className="h-[44px] border-b border-zinc-200 bg-violet-50">
      <div className="flex h-full items-center gap-2 px-3">
        <button className="flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium shadow-sm">
          Table 1 <ChevronDown className="h-4 w-4 text-zinc-500" />
        </button>

        <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-white/60">
          <Plus className="h-4 w-4" /> Add or import
        </button>

        <div className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
          <button className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/60">
            Tools
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
