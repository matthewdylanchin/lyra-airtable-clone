"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/timeAgo";
import {
  Star,
  MoreHorizontal,
  Pencil,
  Copy,
  MoveRight,
  Users,
  Brush,
  Trash2,
  Database,
} from "lucide-react";
import { api } from "@/trpc/react";

export default function BaseCard({ base }: { base: any }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(base.name);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);

  const utils = api.useUtils();

  const deleteBase = api.base.delete.useMutation({
    onSuccess: () => utils.base.listMine.invalidate(),
  });

  const renameBase = api.base.rename.useMutation({
    onSuccess: () => utils.base.listMine.invalidate(),
  });

  // Position menu when opened
  useEffect(() => {
    if (menuOpen && buttonRef.current && cardRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const cardRect = cardRef.current.getBoundingClientRect();

      // Position menu below and to the right of the three-dot button
      setMenuPosition({
        top: buttonRect.bottom - cardRect.top + 4,
        left: buttonRect.left - cardRect.left,
      });
    }
  }, [menuOpen]);

  // Close menu on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Autofocus rename input
  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.focus(), 50);
  }, [renaming]);

  const initials = base.name.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      {/* Prevent link navigation if menu is open */}
      <Link
        ref={cardRef}
        href={menuOpen ? "" : `/base/${base.id}`}
        onClick={(e) => {
          if (menuOpen) e.preventDefault();
        }}
        className="group flex h-[72px] w-[280px] items-center rounded-lg border border-zinc-200 bg-white px-4 py-3.5 transition-all hover:shadow-md"
      >
        {/* Icon */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-200 text-[16px] font-semibold text-purple-800">
          {initials}
        </div>

        {/* Text */}
        <div className="ml-3.5 min-w-0 flex-1">
          {/* TITLE / RENAME */}
          {renaming ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (name !== base.name) {
                  renameBase.mutate({ id: base.id, name });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setRenaming(false);
                  renameBase.mutate({ id: base.id, name });
                }
                if (e.key === "Escape") {
                  setRenaming(false);
                  setName(base.name);
                }
              }}
              className="w-full rounded border border-blue-500 px-1 py-0.5 text-[14px] outline-none"
            />
          ) : (
            <div className="truncate text-[14px] font-semibold text-zinc-900">
              {base.name}
            </div>
          )}

          {/* NORMAL STATE */}
          <div className="mt-0.5 text-[13px] text-zinc-500 group-hover:hidden">
            Opened {timeAgo(base.lastOpenedAt)}
          </div>

          {/* HOVER STATE */}
          <div className="mt-0.5 hidden items-center gap-1 text-[13px] text-zinc-500 group-hover:flex">
            <Database size={13} className="text-zinc-500" />
            Open data
          </div>
        </div>

        {/* Hover actions */}
        <div className="ml-3 hidden items-center gap-2 group-hover:flex">
          <button className="rounded-md p-1 hover:bg-zinc-100">
            <Star size={16} className="text-zinc-500" />
          </button>

          <button
            ref={buttonRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(true);
            }}
            className="rounded-md p-1 hover:bg-zinc-100"
          >
            <MoreHorizontal size={18} className="text-zinc-600" />
          </button>
        </div>
      </Link>

      {/* DROPDOWN MENU */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute z-50 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <MenuItem
            icon={<Pencil size={14} />}
            label="Rename"
            onClick={() => {
              setRenaming(true);
              setMenuOpen(false);
            }}
          />
          <MenuItem icon={<Copy size={14} />} label="Duplicate" />
          <MenuItem icon={<MoveRight size={14} />} label="Move" />
          <MenuItem icon={<Users size={14} />} label="Go to workspace" />
          <MenuItem icon={<Brush size={14} />} label="Customize appearance" />

          <div className="my-1 border-t border-zinc-200" />

          <MenuItem
            icon={<Trash2 size={14} />}
            label="Delete"
            destructive
            onClick={() => deleteBase.mutate({ id: base.id })}
          />
        </div>
      )}
    </div>
  );
}

/* Small Menu Item Component */
function MenuItem({ icon, label, onClick, destructive }: any) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition hover:bg-zinc-50 ${"text-zinc-700"}`}
    >
      <span className={"text-zinc-600"}>{icon}</span>
      <span className="font-normal">{label}</span>
    </button>
  );
}
