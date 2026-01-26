"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  FileSpreadsheet,
  Calendar,
  Sheet,
  FileUp,
  Layers,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { api } from "@/trpc/react";

type TableWithLoading = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _isLoading?: boolean;
};

export default function AddOrImportMenu({
  baseId,
  onCreateTable,
}: {
  baseId: string;
  onCreateTable?: (defaultName: string) => void;
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const { data: tablesData = [] } = api.table.listByBase.useQuery(
    { baseId },
    { enabled: !!baseId },
  );

  const tables = tablesData as TableWithLoading[];

  // Close menu on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        addMenuOpen &&
        !addMenuRef.current?.contains(target) &&
        !addBtnRef.current?.contains(target)
      ) {
        setAddMenuOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [addMenuOpen]);

  const handleCreateTable = () => {
    if (!baseId) return;

    let highestNumber = 0;
    tables.forEach((table) => {
      const match = table.name.match(/^Table (\d+)$/);
      if (match?.[1]) {
        const num = parseInt(match[1], 10);
        if (num > highestNumber) {
          highestNumber = num;
        }
      }
    });

    const defaultName = `Table ${highestNumber + 1}`;
    setAddMenuOpen(false);

    onCreateTable?.(defaultName);
  };

  return (
    <div className="relative flex items-center">
      {/* Vertical divider */}
      <div className="mx-1 h-4 w-px bg-zinc-300" />

      <button
        ref={addBtnRef}
        onClick={() => setAddMenuOpen(!addMenuOpen)}
        className="flex items-center justify-center rounded p-1.5 text-zinc-600 hover:bg-white/60"
        aria-label="Add or import"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>

      {/* Add menu dropdown */}
      {addMenuOpen && (
        <div
          ref={addMenuRef}
          className="absolute top-full left-0 z-50 mt-2 w-72 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg"
        >
          {/* Add a blank table section */}
          <div className="px-4 py-2 text-xs font-medium text-zinc-500">
            Add a blank table
          </div>
          <button
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-blue-50"
            onClick={handleCreateTable}
          >
            Start from scratch
          </button>

          <div className="my-2 border-t border-zinc-200" />

          {/* Build with Omni section */}
          <div className="px-4 py-2 text-xs font-medium text-zinc-500">
            Build with Omni
          </div>
          <button className="w-full px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            New table
          </button>
          <button className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <span>New table with web data</span>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
              Beta
            </span>
          </button>

          <div className="my-2 border-t border-zinc-200" />

          {/* Add from other sources section */}
          <div className="px-4 py-2 text-xs font-medium text-zinc-500">
            Add from other sources
          </div>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <Layers className="h-4 w-4 text-blue-600" />
            </div>
            <span>Airtable base</span>
          </button>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
            </div>
            <span>CSV file</span>
          </button>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <span>Google Calendar</span>
          </button>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <Sheet className="h-4 w-4 text-green-600" />
            </div>
            <span>Google Sheets</span>
          </button>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <FileUp className="h-4 w-4 text-green-700" />
            </div>
            <span>Microsoft Excel</span>
          </button>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <Sparkles className="h-4 w-4 text-blue-500" />
            </div>
            <span>Salesforce</span>
            <span className="ml-auto rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              Business
            </span>
          </button>

          <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex h-5 w-5 items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-zinc-700" />
            </div>
            <span>Smartsheet</span>
          </button>

          <button className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50">
            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center">
                <Layers className="h-4 w-4 text-zinc-400" />
              </div>
              <span>26 more sources...</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>
        </div>
      )}
    </div>
  );
}
