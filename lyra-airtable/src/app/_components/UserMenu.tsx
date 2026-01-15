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

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Position menu adaptively based on available space */
  useEffect(() => {
    if (!open || !btnRef.current) return;

    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 288;
    const menuHeight = 440;
    const gap = 8;

    // Calculate available space in all directions
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Determine vertical position (prefer below, but open above if not enough space)
    const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    let left: number;
    let top: number;

    // Calculate vertical position
    if (openUpward) {
      // Opening upward (at top) - position directly below the button, centered/right-aligned
      top = rect.top - menuHeight - gap;
      // Ensure doesn't go off top
      if (top < gap) {
        top = gap;
      }
      // Align right edge of menu with right edge of button
      left = rect.right - menuWidth;
    } else {
      // Opening downward (at bottom) - position to the right side
      top = rect.bottom + gap;
      // Ensure doesn't go off bottom
      if (top + menuHeight > window.innerHeight - gap) {
        top = window.innerHeight - menuHeight - gap;
      }
      // Position menu to start near the left edge of the button (opens to the right)
      left = rect.left;
    }

    // Final boundary checks for horizontal position
    if (left + menuWidth > window.innerWidth - gap) {
      left = window.innerWidth - menuWidth - gap;
    }
    if (left < gap) {
      left = gap;
    }

    setCoords({ left, top });
  }, [open]);

  /** Close on click outside */
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

  /** Menu element (portaled globally) */
  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 rounded-xl border border-zinc-200 bg-white shadow-xl"
      style={{
        top: coords.top,
        left: coords.left,
      }}
    >
      <div className="max-h-[440px] overflow-y-auto px-3 pt-3 pb-2">
        {/* Header */}
        <div className="mb-2 px-2">
          <div className="text-[13px] font-normal text-zinc-800">
            {user.name}
          </div>
          <div className="text-[12px] text-zinc-500">{user.email}</div>
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
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs text-white"
      >
        {user.name[0]}
      </button>

      {open &&
        typeof window !== "undefined" &&
        createPortal(menu, document.body)}
    </div>
  );
}

/* --- Small Components --- */

function MenuItem({ icon, label, badge, arrow }: any) {
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

// Demo wrapper to show the menu in different positions
export default function Demo() {
  const user = {
    name: "Matthew Dylan Chin",
    email: "matthewdylanchin@gmail.com",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-semibold text-slate-800">
          Adaptive Position User Menu
        </h1>
        <p className="mb-8 text-sm text-slate-600">
          Try clicking the user icons in different corners to see the menu adapt
          its position
        </p>

        {/* Top left */}
        <div className="absolute top-8 left-8">
          <UserMenu user={user} />
        </div>

        {/* Top right */}
        <div className="absolute top-8 right-8">
          <UserMenu user={user} />
        </div>

        {/* Bottom left */}
        <div className="absolute bottom-8 left-8">
          <UserMenu user={user} />
        </div>

        {/* Bottom right */}
        <div className="absolute right-8 bottom-8">
          <UserMenu user={user} />
        </div>

        {/* Center for testing */}
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}
