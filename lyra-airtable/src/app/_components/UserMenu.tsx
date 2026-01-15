"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  UserRound,
  UsersRound,
  Bell,
  Languages,
  Palette,
  Mail,
  Star,
  Link,
  Wrench,
  Trash2,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

export function UserMenu({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fallbacks to avoid TS errors when name/email are null
  const displayName = user.name ?? "User";
  const displayEmail = user.email ?? "No email";

  /** Position menu adaptively based on available space */
  useEffect(() => {
    if (!open || !btnRef.current) return;

    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 288;
    const menuHeight = 440;
    const gap = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    let left = rect.right - menuWidth;
    let top = openUpward ? rect.top - menuHeight - gap : rect.bottom + gap;

    // Clamp vertically
    if (top < gap) top = gap;
    if (top + menuHeight > window.innerHeight - gap)
      top = window.innerHeight - menuHeight - gap;

    // Clamp horizontally
    if (left < gap) left = gap;
    if (left + menuWidth > window.innerWidth - gap)
      left = window.innerWidth - menuWidth - gap;

    setCoords({ left, top });
  }, [open]);

  /** Click outside → close */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /** MENU CONTENT (Portaled) */
  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 rounded-xl border border-zinc-200 bg-white shadow-xl"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="max-h-[440px] overflow-y-auto px-3 pt-3 pb-2">
        {/* Header */}
        <div className="mb-2 px-2">
          <div className="text-[13px] font-normal text-zinc-800">
            {displayName}
          </div>
          <div className="text-[12px] text-zinc-500">{displayEmail}</div>
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
        <MenuItem icon={<Star size={15} />} label="Upgrade" />
        <MenuItem icon={<Mail size={15} />} label="Tell a friend" />

        <Divider />

        <MenuItem icon={<Link size={15} />} label="Integrations" />
        <MenuItem icon={<Wrench size={15} />} label="Builder hub" />

        <Divider />

        <MenuItem icon={<Trash2 size={15} />} label="Trash" />

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-zinc-100"
        >
          <LogOut size={15} />
          <span className="font-normal">Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs text-white"
      >
        {displayName[0]}
      </button>

      {open &&
        typeof window !== "undefined" &&
        createPortal(menu, document.body)}
    </div>
  );
}

/* --- Small Components --- */
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
        <span>{label}</span>

        {badge === "Business" && (
          <span className="rounded-full bg-blue-100 px-2 py-[1px] text-[10px] text-blue-700">
            Business
          </span>
        )}
        {badge === "Beta" && (
          <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10px] text-amber-700">
            Beta
          </span>
        )}
      </div>

      {arrow && <span className="text-zinc-400">›</span>}
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-zinc-200" />;
}
