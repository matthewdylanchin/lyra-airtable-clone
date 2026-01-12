import { ChevronDown, SquareMousePointer } from "lucide-react";

export default function AppTopBar() {
  return (
    <div className="h-[44px] border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-full items-center justify-between px-3">
        {/* Left: base name */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-violet-200" />
          <button className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100">
            Base 123 <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        {/* Center: nav */}
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-600">
          <button className="text-zinc-900">Data</button>
          <button className="hover:text-zinc-900">Automations</button>
          <button className="hover:text-zinc-900">Interfaces</button>
          <button className="hover:text-zinc-900">Forms</button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">
            <SquareMousePointer className="h-5 w-5 text-zinc-600" />
            <span>Launch</span>
          </button>
          <button className="flex items-center gap-2 rounded-md bg-violet-200 px-3 py-1.5 text-sm font-medium hover:bg-violet-300">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
