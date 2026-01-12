export default function GridShell() {
  return (
    <div className="h-full overflow-auto bg-zinc-50">
      {/* This is where TanStack Table will go */}
      <div className="min-h-full bg-white">
        <div className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500">
          3 records
        </div>

        <div className="p-6 text-sm text-zinc-500">
          Grid will render here (TanStack Table + virtualization next).
        </div>
      </div>
    </div>
  );
}