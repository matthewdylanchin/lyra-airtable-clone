"use client";

import {
  Star,
  Share2,
  Home,
  Plus,
  ChevronRight,
  Users,
  Upload,
  ShoppingBag,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import CreateModal from "./CreateModal";

export default function HomeSidebar() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex h-full w-[280px] flex-col border-r border-zinc-200 bg-white">
      {/* Nav items */}
      <div className="px-3 pt-2">
        <SidebarItem icon={<Home size={16} />} label="Home" active />
        <SidebarItem icon={<Star size={16} />} label="Starred" hasChevron />
        <SidebarItem icon={<Share2 size={16} />} label="Shared" />
        <SidebarItem
          icon={<Users size={16} />}
          label="Workspaces"
          hasPlus
          hasChevron
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section */}
      <div className="border-t border-zinc-200 px-3 py-3">
        <div className="mb-3 space-y-0.5">
          <BottomItem
            icon={<BookOpen size={16} />}
            label="Templates and apps"
          />
          <BottomItem icon={<ShoppingBag size={16} />} label="Marketplace" />
          <BottomItem icon={<Upload size={16} />} label="Import" />
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={16} strokeWidth={2.5} /> Create
        </button>

        <CreateModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  hasChevron,
  hasPlus,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  hasChevron?: boolean;
  hasPlus?: boolean;
}) {
  return (
    <div
      className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-normal transition ${
        active ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      <span className="text-zinc-700">{icon}</span>
      <span className="flex-1">{label}</span>
      {hasPlus && <Plus size={14} strokeWidth={2} className="text-zinc-500" />}
      {hasChevron && (
        <ChevronRight size={14} strokeWidth={2} className="text-zinc-400" />
      )}
    </div>
  );
}

function BottomItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-normal text-zinc-700 transition hover:bg-zinc-50">
      <span className="text-zinc-600">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
