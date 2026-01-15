import Link from "next/link";
import { timeAgo } from "@/lib/timeAgo";

export default function BaseCard({ base }: { base: any }) {
  const initials = base.name.slice(0, 2).toUpperCase();
  const lastOpened = timeAgo(base.lastOpenedAt); // ← use your timestamp field

  return (
    <Link
      href={`/base/${base.id}`}
      className="group flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-3.5 transition-all hover:shadow-md"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-200 text-[16px] font-semibold text-purple-800">
        {initials}
      </div>

      {/* Text */}
      <div className="ml-3.5 min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-zinc-900">
          {base.name}
        </div>
        <div className="mt-0.5 text-[13px] text-zinc-500">
          Opened {timeAgo(base.lastOpenedAt)}
        </div>
      </div>
    </Link>
  );
}
