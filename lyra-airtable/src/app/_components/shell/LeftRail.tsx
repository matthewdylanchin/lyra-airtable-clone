import { Plus, Search } from "lucide-react";

export default function LeftRail() {
  return (
    <div className="w-[280px] border-r border-zinc-200 bg-white">
      <div className="p-3">
        <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100">
          <span className="font-medium">Create new...</span>
          <Plus className="h-4 w-4 text-zinc-500" />
        </button>

        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            placeholder="Find a view"
            className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-zinc-300"
          />
        </div>
      </div>

      <div className="px-2">
        <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium">
          Grid view
        </div>
      </div>
    </div>
  );
}