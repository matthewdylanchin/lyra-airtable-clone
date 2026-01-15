"use client";

import { Menu, HelpCircle, Bell } from "lucide-react";
import Image from "next/image";
import { UserMenu } from "../UserMenu";
import HomeSearchBar from "./HomeSearchbar";

export default function HomeTopBar({ user }: { user: any }) {
  return (
    <header className="relative z-40 flex h-[48px] items-center border-b border-zinc-200 bg-white px-4">
      {/* Left section — menu icon + Airtable logo */}
      <div className="flex min-w-[240px] items-center gap-3">
        <button className="rounded-md p-1 hover:bg-zinc-100">
          <Menu size={18} strokeWidth={1.5} />
        </button>

        {/* Airtable logo + name */}
        <div className="flex items-center gap-1">
          <Image src="/airtable.png" alt="Airtable" width={20} height={20} />
          <span className="text-[15px] font-medium text-zinc-700">
            Airtable
          </span>
        </div>
      </div>

      {/* Middle — Search bar */}
      <div className="flex flex-1 justify-center">
        <HomeSearchBar />
      </div>

      {/* Right section — Help, bell, user */}
      <div className="flex items-center gap-4 pr-2">
        <button className="rounded-md p-1 hover:bg-zinc-100">
          <HelpCircle size={18} strokeWidth={1.5} />
        </button>

        <button className="rounded-md p-1 hover:bg-zinc-100">
          <Bell size={18} strokeWidth={1.5} />
        </button>

        {/* FIX: wrapper ensures it gets clicks */}
        <div className="relative z-50">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
