"use client";

type BottomBarProps = {
  rowCount: number;
};

export default function BottomBar({ rowCount }: BottomBarProps) {
  return (
    <div className="h-6=3 flex items-center justify-between border-t border-gray-200 bg-white px-4 text-sm text-zinc-600">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <span className="font-medium">{rowCount} records</span>
      </div>

      {/* Right side (placeholder for future actions) */}
      <div className="h-full" />
    </div>
  );
}
