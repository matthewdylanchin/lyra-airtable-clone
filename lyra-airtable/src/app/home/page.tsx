"use client";

import { api } from "@/trpc/react";
import BaseCard from "../_components/HomeComponents/BaseCard";

export default function HomePage() {
  const { data: bases } = api.base.listMine.useQuery();

  return (
    <div className="h-full min-h-screen w-full bg-zinc-50 p-10">
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">Home</h1>

      <div className="mb-3 text-sm text-zinc-500">Today</div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {bases?.map((b) => (
          <BaseCard key={b.id} base={b} />
        ))}
      </div>
    </div>
  );
}
