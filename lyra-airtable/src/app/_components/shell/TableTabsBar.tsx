import { ChevronDown, Plus } from "lucide-react";

export default function TableTabsBar() {
  return (
    <div className="relative h-[35px] overflow-visible border-b border-zinc-200 bg-violet-50">
      <div className="flex h-full items-end gap-2 pr-3 pl-1">
        <div className="relative">
          <button className="relative z-50 -mb-[6px] flex items-center gap-1 rounded-l-none rounded-r-[10px] bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[2px] after:bg-white after:content-['']">
            <span>Table 1</span>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>

          {/* mask ONLY the bottom border under the pill */}
          <div className="pointer-events-none absolute right-[-4px] bottom-[-1px] left-[-12px] h-[2px] bg-white" />
        </div>

        <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-white/60">
          <Plus className="h-4 w-4" /> Add or import
        </button>

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
