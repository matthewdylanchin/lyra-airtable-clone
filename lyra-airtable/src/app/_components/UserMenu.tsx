"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  UserRound,
  UsersRound,
  Bell,
  Languages,
  Palette,
  Mail,
  CircleStar,
  Link,
  Wrench,
  Trash2,
  LogOut,
} from "lucide-react";

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect click outside -> close menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {/* Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-medium text-white"
      >
        {user.name[0]}
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={menuRef}
          className="absolute bottom-0 left-12 z-50 flex w-72 flex-col rounded-xl border border-zinc-200 bg-white shadow-xl"
        >
          {/* Scrollable content */}
          <div className="max-h-[470px] overflow-y-auto px-3 pt-3 pb-2">
            {/* Header */}
            <div className="mb-2 px-2">
              <div className="text-[13px] font-normal text-zinc-800">
                {user.name}
              </div>
              <div className="text-[12px] leading-tight text-zinc-500">
                {user.email}
              </div>
            </div>

            <Divider />

            <MenuItem icon={<UserRound size={15} />} label="Account" />
            <MenuItem
              icon={<UsersRound size={15} />}
              label="Manage groups"
              badge="Business"
            />
            <MenuItem
              icon={<Bell size={15} />}
              label="Notification preferences"
              arrow
            />
            <MenuItem
              icon={<Languages size={15} />}
              label="Language preferences"
              arrow
            />
            <MenuItem
              icon={<Palette size={15} />}
              label="Appearance"
              badge="Beta"
              arrow
            />

            <Divider />

            <MenuItem icon={<Mail size={15} />} label="Contact sales" />
            <MenuItem icon={<CircleStar size={15} />} label="Upgrade" />
            <MenuItem icon={<Mail size={15} />} label="Tell a friend" />

            <Divider />

            <MenuItem icon={<Link size={15} />} label="Integrations" />
            <MenuItem icon={<Wrench size={15} />} label="Builder hub" />

            <Divider />

            <MenuItem icon={<Trash2 size={15} />} label="Trash" />
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full hover:bg-zinc-100 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px]"
            >
              <LogOut size={15} />
              <span className="font-normal">Log out</span>
            </button>
          </div>

          {/* Logout footer — fixed at bottom
          <div className="border-t px-3 py-2">
          </div> */}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  badge,
  arrow,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  arrow?: boolean;
}) {
  return (
    <div className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-zinc-100">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-normal">{label}</span>
        {badge && (
          <span
            className={`ml-1 rounded-full px-2 py-[1px] text-[10px] ${badge === "Business" ? "bg-blue-100 text-blue-700" : ""} ${badge === "Beta" ? "bg-amber-100 text-amber-700" : ""} `}
          >
            {badge}
          </span>
        )}
      </div>
      {arrow && <span className="text-[13px] text-zinc-400">›</span>}
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-zinc-200" />;
}
