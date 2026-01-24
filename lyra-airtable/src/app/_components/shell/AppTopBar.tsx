"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  SquareMousePointer,
  Star,
  MoreHorizontal,
} from "lucide-react";
import { api } from "@/trpc/react";
import { TableLoadingIndicator } from "@/app/base/[baseId]/table/[tableId]/Components/LoadingIndicator";
import { useTableView } from "@/app/base/[baseId]/table/[tableId]/TableViewContext";

export default function AppTopBar() {
  const params = useParams<{ baseId: string }>();
  const baseId = params.baseId;

  const { isBusy } = useTableView();
  const [showSpinner, setShowSpinner] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isBaseGuideOpen, setIsBaseGuideOpen] = useState(true);

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  // Fetch base data
  const { data: base } = api.base.getById.useQuery(baseId, {
    enabled: !!baseId,
  });

  // Rename base mutation
  const renameBase = api.base.rename.useMutation({
    onSuccess: () => {
      void utils.base.getById.invalidate(baseId);
    },
  });

  useEffect(() => {
    if (isBusy) {
      const t = setTimeout(() => setShowSpinner(true), 150);
      return () => clearTimeout(t);
    }
    setShowSpinner(false);
  }, [isBusy]);

  // Sync editedName when base loads or panel opens
  useEffect(() => {
    if (base && isPanelOpen) {
      setEditedName(base.name);
    }
  }, [base, isPanelOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setIsPanelOpen(false);
        setIsNameFocused(false);
      }
    };

    if (isPanelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isPanelOpen]);

  const handleOpenPanel = () => {
    setIsPanelOpen(!isPanelOpen);
    if (!isPanelOpen && base) {
      setEditedName(base.name);
    }
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName.trim() !== base?.name) {
      renameBase.mutate({ id: baseId, name: editedName.trim() });
    } else if (base) {
      setEditedName(base.name);
    }
    setIsNameFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
      nameInputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditedName(base?.name ?? "");
      setIsNameFocused(false);
      nameInputRef.current?.blur();
    }
  };

  return (
    <div className="relative z-[100] h-[44px] border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-full items-center justify-between px-3">
        {/* Left: base name */}
        <div className="relative flex items-center gap-2">
          {/* Base Logo */}
          <div className="relative h-6 w-6 overflow-hidden rounded">
            <Image
              src="/BaseLogo.png"
              alt="Base logo"
              fill
              className="object-cover"
            />
          </div>

          {/* Base Name Button */}
          <button
            ref={buttonRef}
            onClick={handleOpenPanel}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100"
          >
            {base?.name ?? "Loading..."}
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>

          {/* Dropdown Panel */}
          {isPanelOpen && (
            <div
              ref={panelRef}
              className="absolute top-full left-0 z-[9999] mt-1 w-[380px] rounded-lg border border-zinc-200 bg-white shadow-xl"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <input
                  ref={nameInputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onFocus={() => setIsNameFocused(true)}
                  onBlur={handleSaveName}
                  onKeyDown={handleKeyDown}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[18px] text-zinc-700 transition-all outline-none ${
                    isNameFocused
                      ? "border-2 border-zinc-400 bg-white"
                      : "border border-transparent bg-transparent hover:bg-zinc-100"
                  }`}
                />

                <div className="flex items-center gap-0.5">
                  <button
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    title="Add to favorites"
                  >
                    <Star className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    title="More options"
                  >
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>

              {/* ✅ Single divider after header */}
              <div className="border-t border-zinc-200" />

              {/* Content */}
              <div className="px-2 pt-1 pb-2">
                {/* Appearance Section */}
                <button
                  onClick={() => setIsAppearanceOpen(!isAppearanceOpen)}
                  className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <ChevronRight
                    className={`h-4 w-4 text-zinc-400 transition-transform duration-150 ${
                      isAppearanceOpen ? "rotate-90" : ""
                    }`}
                  />
                  <span>Appearance</span>
                </button>

                {isAppearanceOpen && (
                  <div className="py-2 pr-3 pl-7">
                    <p className="text-[13px] leading-5 text-zinc-500">
                      Customize the look and feel of your base.
                    </p>
                  </div>
                )}

                <div className="border-t border-zinc-200" />
                {/* Base Guide Section */}
                <button
                  onClick={() => setIsBaseGuideOpen(!isBaseGuideOpen)}
                  className="mt-1 flex w-full items-center gap-1 rounded px-2 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  <ChevronRight
                    className={`h-4 w-4 text-zinc-400 transition-transform duration-150 ${
                      isBaseGuideOpen ? "rotate-90" : ""
                    }`}
                  />
                  <span>Base guide</span>
                </button>

                {isBaseGuideOpen && (
                  <div className="space-y-3 py-2 pr-3 pl-7">
                    <p className="text-[13px] leading-5 text-zinc-500">
                      Use this space to share the goals and details of your base
                      with your team.
                    </p>

                    <p className="text-[13px] leading-5 text-zinc-500">
                      Start by outlining your goal.
                    </p>

                    <p className="text-[13px] leading-5 text-zinc-500">
                      Next, share details about key information in your base:
                    </p>

                    <div className="space-y-1">
                      <p className="text-[13px] leading-5 text-zinc-400">
                        This table contains...
                      </p>
                      <p className="text-[13px] leading-5 text-zinc-400">
                        This view shows...
                      </p>
                      <p className="text-[13px] leading-5 text-zinc-400">
                        This link contains...
                      </p>
                    </div>

                    <p className="text-[13px] leading-5 text-zinc-500">
                      Teammates will see this guide when they first open the
                      base and can find it anytime by clicking the down arrow on
                      the top of their screen.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center: nav */}
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-600">
          <button className="text-zinc-900">Data</button>
          <button className="hover:text-zinc-900">Automations</button>
          <button className="hover:text-zinc-900">Interfaces</button>
          <button className="hover:text-zinc-900">Forms</button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {showSpinner && <TableLoadingIndicator isLoading />}
          <button className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">
            <SquareMousePointer className="h-5 w-5 text-zinc-600" />
            <span>Launch</span>
          </button>
          <button className="flex items-center gap-2 rounded-md bg-violet-200 px-3 py-1.5 text-sm font-medium hover:bg-violet-300">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
