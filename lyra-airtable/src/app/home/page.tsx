"use client";

import { api } from "@/trpc/react";
import BaseCard from "../_components/HomeComponents/BaseCard";

export default function HomePage() {
  const { data: bases } = api.base.listMine.useQuery();

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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              createBase.mutate({ name: "Untitled Base" });
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            + Create
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Home</h1>

      <div className="mb-3 text-sm text-zinc-500">Today</div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
        {bases?.map((b) => (
          <BaseCard key={b.id} base={b} />
        ))}
      </div>
    </div>
  );
}
