"use client";

import { Star, Folder, User, Home, Plus } from "lucide-react";
import { useState } from "react";
import CreateModal from "./CreateModal";

export default function HomeSidebar() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex h-full w-[240px] flex-col border-r bg-[#fafafa]">
      {/* Top section */}
      <div className="px-4 pt-5 pb-3 text-[13px] font-medium text-zinc-700">
        Home
      </div>

      {/* Nav items */}
      <SidebarItem icon={<Star size={15} />} label="Starred" />
      <SidebarItem icon={<User size={15} />} label="Shared" />
      <SidebarItem icon={<Folder size={15} />} label="Workspaces" />

      {/* Bottom section */}
      <div className="mt-auto border-t p-4">
        <button
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 text-sm text-white transition hover:bg-blue-700"
        >
          <Plus size={16} /> Create
        </button>

        <CreateModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex cursor-pointer items-center gap-3 px-4 py-2 text-[13px] text-zinc-600 transition hover:bg-zinc-200/60">
      {icon}
      {label}
    </div>
  );
}
