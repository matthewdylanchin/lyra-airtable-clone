import Link from "next/link";

export default function BaseCard({ base }: { base: any }) {
  const initials = base.name.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/base/${base.id}`}
      className="group flex h-[88px] w-[260px] items-center rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-200 text-sm font-semibold text-purple-800">
        {initials}
      </div>

      {/* Text */}
      <div className="ml-4">
        <div className="text-[14px] leading-tight font-medium">{base.name}</div>
        <div className="text-[12px] leading-tight text-zinc-500">
          Opened recently
        </div>
      </div>
    </Link>
  );
}
