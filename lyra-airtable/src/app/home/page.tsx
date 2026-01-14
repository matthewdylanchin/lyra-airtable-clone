"use client";

import { api } from "@/trpc/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  const { data: bases, isLoading } = api.base.listMine.useQuery();
  const createBase = api.base.create.useMutation();

  if (isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      {/* Left sidebar */}
      <aside className="w-[260px] border-r bg-white p-4">
        <div className="mb-4 text-lg font-semibold">Airtable</div>

        <nav className="space-y-2 text-sm">
          <div className="font-medium">Home</div>
          <div className="text-zinc-500">Starred</div>
          <div className="text-zinc-500">Shared</div>
        </nav>

        {/* Create button (bottom-left) */}
        <div className="absolute bottom-4 left-4">
          <button
            type="button"
            onClick={() => createBase.mutate({ name: "Untitled Base" })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            + Create
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Home</h1>

        {!bases || bases.length === 0 ? (
          <EmptyState />
        ) : (
          <BaseGrid bases={bases} />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-zinc-500">
      No bases yet — click <span className="mx-1 font-medium">Create</span> to
      get started.
    </div>
  );
}

function BaseGrid({
  bases,
}: {
  bases: { id: string; name: string; updatedAt: Date }[];
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {bases.map((b) => (
        <Link
          key={b.id}
          href={`/base/${b.id}`}
          className="rounded-lg border bg-white p-4 hover:shadow-sm"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded bg-blue-600 font-semibold text-white">
            {b.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="font-medium">{b.name}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Updated {new Date(b.updatedAt).toLocaleString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
