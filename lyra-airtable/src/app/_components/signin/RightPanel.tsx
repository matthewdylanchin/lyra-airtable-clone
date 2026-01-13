export default function RightPanel() {
  return (
    <div className="hidden w-[420px] lg:block">
      <div className="group relative origin-center overflow-hidden rounded-2xl bg-gradient-to-b from-purple-950 to-purple-800 p-8 text-white shadow-sm transition-transform duration-300 ease-out hover:scale-[1.02] hover:shadow-lg">
        {/* shine */}
        <div className="pointer-events-none absolute -inset-x-20 -inset-y-10 rotate-12 bg-white/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

        <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
          Meet Omni, your AI collaborator for building custom apps.
        </h2>

        <button className="mt-6 h-[36px] rounded-md bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">
          Start building
        </button>

        {/* grid animates on hover */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-white/10 transition-transform duration-300 group-hover:-translate-y-0.5"
              style={{ transitionDelay: `${i * 20}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
