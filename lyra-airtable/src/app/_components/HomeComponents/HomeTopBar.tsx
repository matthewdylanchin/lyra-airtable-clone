"use client";

import { Menu, HelpCircle, Bell } from "lucide-react";
import Image from "next/image";
import { UserMenu } from "../UserMenu";
import HomeSearchBar from "./HomeSearchbar";
import type { Session } from "next-auth";

export default function HomeTopBar({
  user,
}: {
  user:
    | {
        name?: string | null;
        email?: string | null;
      }
    | null
    | undefined;
}) {
  return (
    <header className="relative z-40 flex h-[49px] items-center border-b border-zinc-200 bg-white px-4">
      {/* Left section — menu icon + Airtable logo */}
      <div className="flex items-center gap-2.5">
        <button className="flex items-center justify-center rounded p-1 hover:bg-zinc-100">
          <Menu size={18} strokeWidth={1.5} className="text-zinc-600" />
        </button>

        {/* Airtable logo + name */}
        <div className="flex items-center gap-2">
          <Image src="/airtable.png" alt="Airtable" width={22} height={22} />
          <span className="text-[15px] font-semibold text-zinc-900">
            Airtable
          </span>
        </div>
      </div>

      {/* Middle — Search bar */}
      <div className="flex flex-1 justify-center px-6">
        <HomeSearchBar />
      </div>

      {/* Right section — Help, bell, user */}
      <div className="flex items-center gap-6 pr-2">
        <button className="flex items-center gap-1 rounded p-1 hover:bg-zinc-100">
          <HelpCircle size={18} strokeWidth={1.5} className="text-zinc-600" />
          <span className="text-[13px] text-zinc-600">Help</span>
        </button>

        <button className="flex items-center justify-center rounded p-1 hover:bg-zinc-100">
          <Bell size={18} strokeWidth={1.5} className="text-zinc-600" />
        </button>

        <div className="relative z-50">
          <UserMenu
            user={{
              name: user?.name ?? "User",
              email: user?.email ?? "No email",
            }}
          />
        </div>
      </div>
    </header>
  );
}
