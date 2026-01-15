"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { UserMenu } from "../UserMenu";
import { Boxes, HelpCircle, Bell } from "lucide-react";

export default function BaseSidebar() {
  const [hoverLogo, setHoverLogo] = useState(false);
  const { data: session } = useSession();

  const userInitial =
    session?.user?.name?.[0]?.toUpperCase() ??
    session?.user?.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <div className="flex h-full w-[56px] flex-col items-center border-r border-zinc-200 bg-zinc-50 py-3">
      {/* Top section */}
      <div className="flex flex-col items-center gap-4">
        {/* Logo / Back */}
        <Link
          href="/home"
          onMouseEnter={() => setHoverLogo(true)}
          onMouseLeave={() => setHoverLogo(false)}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-zinc-200"
        >
          {hoverLogo ? (
            <span className="text-xs font-semibold text-zinc-700">←</span>
          ) : (
            <Image
              src="/Airtable BNW.png"
              alt="Airtable"
              width={20}
              height={20}
            />
          )}
        </Link>

        {/* Workspace / base icon */}
        <Boxes className="h-5 w-5 cursor-pointer text-zinc-600" />

        {/* Sync indicator */}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-4 pb-2">
        <HelpCircle className="h-5 w-5 cursor-pointer text-zinc-500 hover:text-zinc-700" />
        <Bell className="h-5 w-5 cursor-pointer text-zinc-500 hover:text-zinc-700" />

        {/* Avatar */}
        <UserMenu
          user={{
            name: session?.user?.name ?? "User",
            email: session?.user?.email ?? "No email",
          }}
        />
      </div>
    </div>
  );
}
