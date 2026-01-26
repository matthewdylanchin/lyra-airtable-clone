"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  EyeOff,
  SlidersHorizontal,
  Copy,
  Link2,
  Info,
  Lock,
  X,
  Trash2,
  CircleArrowUp,
} from "lucide-react";
import { api } from "@/trpc/react";
import AddOrImportMenu from "./AddOrImportMenu";
import { useEffect, useRef, useState } from "react";

type TableWithLoading = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _isLoading?: boolean;
  _isDeleting?: boolean;
};

export default function TableTabsBar() {
  const params = useParams<{ baseId?: string; tableId?: string }>();
  const baseId = params.baseId;
  const activeTableId = params.tableId;
  const router = useRouter();

  const [tableMenuOpen, setTableMenuOpen] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [pendingCreateName, setPendingCreateName] = useState<string | null>(
    null,
  );

  // Track tables being deleted to prevent double-clicks
  const deletingTableIds = useRef<Set<string>>(new Set());

  // Fix: prefer Record<string, ...> instead of index signature
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const utils = api.useUtils();

  // ✅ Hooks MUST be before any early return
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;

      if (tableMenuOpen) {
        const menuRef = menuRefs.current[tableMenuOpen];
        if (menuRef && !menuRef.contains(target)) {
          setTableMenuOpen(null);
        }
      }

      if (renameModalOpen) {
        const renameRef = menuRefs.current[`rename-${renameModalOpen}`];
        if (renameRef && !renameRef.contains(target)) {
          setRenameModalOpen(null);
          setNewTableName("");
          setNameError(null);
        }
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTableMenuOpen(null);
        setRenameModalOpen(null);
        setNewTableName("");
        setNameError(null);
      }
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [tableMenuOpen, renameModalOpen]);

  if (!baseId) {
    return (
      <div className="relative h-[35px] border-b border-zinc-200 bg-violet-50" />
    );
  }

  const { data: tablesData, isLoading } = api.table.listByBase.useQuery(
    { baseId },
    { enabled: !!baseId },
  );

  // Sort tables by createdAt to ensure new tables appear at the end
  // Filter out tables that are being deleted
  const tables = (tablesData as TableWithLoading[] | undefined)
    ?.slice()
    .filter((t) => !t._isDeleting)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const createTable = api.table.create.useMutation({
    onMutate: async (variables) => {
      await utils.table.listByBase.cancel({ baseId });
      const previousTables = utils.table.listByBase.getData({ baseId });

      const tempTableId = `temp-${Date.now()}`;
      const optimisticTable: TableWithLoading = {
        id: tempTableId,
        name: variables.name,
        createdAt: new Date(),
        updatedAt: new Date(),
        _isLoading: true,
      };

      utils.table.listByBase.setData({ baseId }, (old) => {
        if (!old) return [optimisticTable];
        return [...old, optimisticTable] as TableWithLoading[];
      });

      // Store the pending create name and open modal immediately
      setPendingCreateName(variables.name);
      setNewTableName(variables.name);
      setRenameModalOpen(tempTableId);

      return { previousTables, tempTableId };
    },

    onSuccess: (newTable, _variables, context) => {
      utils.table.listByBase.setData({ baseId }, (old) => {
        if (!old) return [newTable];
        return old.map((t) =>
          t.id === context?.tempTableId ? newTable : t,
        ) as TableWithLoading[];
      });

      // Update the rename modal to point to the real table ID
      if (renameModalOpen === context?.tempTableId) {
        setRenameModalOpen(newTable.id);
      }

      router.push(`/base/${baseId}/table/${newTable.id}`);
      setPendingCreateName(null);
      void utils.table.listByBase.invalidate({ baseId });
    },

    onError: (_err, _variables, context) => {
      if (context?.previousTables) {
        utils.table.listByBase.setData({ baseId }, context.previousTables);
      }
      setRenameModalOpen(null);
      setPendingCreateName(null);
      setNewTableName("");
    },
  });

  const renameTable = api.table.rename?.useMutation({
    onSuccess: async () => {
      await utils.table.listByBase.invalidate({ baseId });
      setRenameModalOpen(null);
      setNewTableName("");
      setNameError(null);
    },
    onError: (error) => {
      if (error.message === "Please enter a unique table name") {
        setNameError("Please enter a unique table name");
      }
    },
  });

  const deleteTable = api.table.delete?.useMutation({
    onMutate: async (variables) => {
      // Don't await - fire and forget to avoid blocking
      void utils.table.listByBase.cancel({ baseId });

      const previousTables = utils.table.listByBase.getData({ baseId });

      // Mark table as deleting in cache (will be filtered out in render)
      utils.table.listByBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === variables.tableId ? { ...t, _isDeleting: true } : t,
        ) as TableWithLoading[];
      });

      // Close menu immediately
      setTableMenuOpen(null);

      // Handle navigation if deleting active table
      if (activeTableId === variables.tableId) {
        const remainingTables = previousTables?.filter(
          (t) => t.id !== variables.tableId,
        );
        const firstTable = remainingTables?.[0];

        if (firstTable) {
          router.push(`/base/${baseId}/table/${firstTable.id}`);
        } else {
          router.push(`/base/${baseId}`);
        }
      }

      return { previousTables, tableId: variables.tableId };
    },

    onSuccess: async (_data, _variables, context) => {
      // Remove from tracking set
      if (context?.tableId) {
        deletingTableIds.current.delete(context.tableId);
      }

      // Actually remove the table from cache now
      utils.table.listByBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.filter((t) => t.id !== context?.tableId);
      });

      // Invalidate to sync with server
      await utils.table.listByBase.invalidate({ baseId });
    },

    onError: (err, variables, context) => {
      console.error("Failed to delete table:", err);

      // Remove from tracking set
      deletingTableIds.current.delete(variables.tableId);

      // Restore previous state
      if (context?.previousTables) {
        utils.table.listByBase.setData({ baseId }, context.previousTables);
      }
    },
  });

  const handleCreateTable = (defaultName: string) => {
    createTable.mutate({ baseId, name: defaultName });
  };

  const handleRenameSubmit = () => {
    if (!renameModalOpen || !newTableName.trim()) return;

    // Check for duplicate names
    const isDuplicate = tables?.some(
      (t) =>
        t.id !== renameModalOpen &&
        t.name.toLowerCase() === newTableName.trim().toLowerCase(),
    );

    if (isDuplicate) {
      setNameError("Please enter a unique table name");
      return;
    }

    setNameError(null);

    // If this is a temp table (just created), we don't need to rename
    // The table was already created with the name
    if (renameModalOpen.startsWith("temp-")) {
      // Just close the modal, table is already created
      setRenameModalOpen(null);
      setNewTableName("");
      return;
    }

    // Check if name actually changed
    const currentTable = tables?.find((t) => t.id === renameModalOpen);
    if (currentTable?.name === newTableName.trim()) {
      setRenameModalOpen(null);
      setNewTableName("");
      return;
    }

    renameTable?.mutate({
      tableId: renameModalOpen,
      name: newTableName.trim(),
    });
  };

  const handleDeleteTable = (tableId: string) => {
    // Prevent double-clicks
    if (deletingTableIds.current.has(tableId)) {
      return;
    }

    // Track this table as being deleted
    deletingTableIds.current.add(tableId);

    deleteTable?.mutate({ tableId });
  };

  const handleNameChange = (value: string) => {
    setNewTableName(value);
    if (nameError) {
      setNameError(null);
    }
  };

  // Get the position of a tab for modal positioning
  const getTabPosition = (tableId: string) => {
    const tabRef = tabRefs.current[tableId];
    if (tabRef) {
      return {
        left: tabRef.offsetLeft,
      };
    }
    return { left: 0 };
  };

  return (
    <div className="relative h-[35px] overflow-visible border-b border-zinc-200 bg-violet-50">
      <div className="flex h-full items-center gap-0 pr-3">
        {/* Tabs */}
        <div className="flex items-center">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
          ) : (
            (tables ?? []).map((t, index) => {
              const isActive = t.id === activeTableId;
              const isFirst = index === 0;

              return (
                <div
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  className="relative"
                >
                  {/* Vertical divider between tabs (except first) */}
                  {!isFirst && !isActive && (
                    <div className="absolute top-1/2 left-0 h-4 w-px -translate-y-1/2 bg-zinc-300" />
                  )}

                  <Link
                    href={`/base/${baseId}/table/${t.id}`}
                    className={`flex items-center gap-1 px-3 text-sm font-medium ${
                      isActive
                        ? `relative z-50 mb-[-2px] border-x border-t border-x-zinc-200 border-t-zinc-200 bg-white py-1.5 pb-[calc(0.375rem+2px)] text-zinc-900 ${
                            isFirst ? "rounded-tr-[4px]" : "rounded-t-[4px]"
                          }`
                        : "rounded bg-transparent py-1.5 text-zinc-700 hover:bg-white/60"
                    }`}
                  >
                    {t._isLoading && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    <span>{t.name}</span>
                    {isActive && !t._isLoading && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTableMenuOpen(
                            tableMenuOpen === t.id ? null : t.id,
                          );
                        }}
                        className="rounded p-0.5 hover:bg-zinc-100"
                      >
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      </button>
                    )}
                  </Link>

                  {/* Table dropdown menu */}
                  {tableMenuOpen === t.id && (
                    <div
                      ref={(el) => {
                        menuRefs.current[t.id] = el;
                      }}
                      className="absolute top-full left-0 z-[100] mt-2 w-64 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg"
                    >
                      <button className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <div className="flex items-center gap-3">
                          <CircleArrowUp className="h-4 w-4" />
                          <span>Import data</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      </button>

                      <div className="my-2 border-t border-zinc-200" />

                      <button
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                        onClick={() => {
                          setNewTableName(t.name);
                          setTableMenuOpen(null);
                          setRenameModalOpen(t.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Rename table</span>
                      </button>
                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <EyeOff className="h-4 w-4" />
                        <span>Hide table</span>
                      </button>
                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Manage fields</span>
                      </button>
                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <Copy className="h-4 w-4" />
                        <span>Duplicate table</span>
                      </button>

                      <div className="my-2 border-t border-zinc-200" />

                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <Link2 className="h-4 w-4" />
                        <span>Configure date dependencies</span>
                      </button>

                      <div className="my-2 border-t border-zinc-200" />

                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <Info className="h-4 w-4" />
                        <span>Edit table description</span>
                      </button>
                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <Lock className="h-4 w-4" />
                        <span>Edit table permissions</span>
                      </button>

                      <div className="my-2 border-t border-zinc-200" />

                      <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                        <X className="h-4 w-4" />
                        <span>Clear data</span>
                      </button>
                      <button
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleDeleteTable(t.id)}
                        disabled={deletingTableIds.current.has(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete table</span>
                      </button>
                    </div>
                  )}

                  {/* Rename modal - positioned below tab */}
                  {renameModalOpen === t.id && (
                    <div
                      ref={(el) => {
                        menuRefs.current[`rename-${t.id}`] = el;
                      }}
                      className="absolute top-full left-0 z-[100] mt-2 w-[420px] rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
                    >
                      <div className="mb-4">
                        <input
                          type="text"
                          value={newTableName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSubmit();
                          }}
                          className={`w-full rounded-lg border-2 px-4 py-3 text-base focus:outline-none ${
                            nameError ? "border-blue-500" : "border-blue-500"
                          }`}
                          autoFocus
                          placeholder="Table name"
                        />
                        {/* Error tooltip */}
                        {nameError && (
                          <div className="relative mt-1">
                            <div className="absolute -top-1 left-4">
                              <div className="h-0 w-0 border-r-[6px] border-b-[6px] border-l-[6px] border-r-transparent border-b-red-100 border-l-transparent" />
                            </div>
                            <div className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
                              {nameError}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="mb-2 flex items-center gap-2 text-sm text-zinc-600">
                          <span>What should each record be called?</span>
                          <button className="text-zinc-400 hover:text-zinc-600">
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            defaultValue="Record"
                            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 pr-10 text-sm focus:border-zinc-400 focus:outline-none"
                            readOnly
                          />
                          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        </div>
                      </div>

                      <div className="mb-5 text-sm text-zinc-500">
                        <span>Examples: </span>
                        <span className="text-zinc-600">+ Add record</span>
                        <span className="mx-3 text-zinc-600">
                          ✉ Send records
                        </span>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setRenameModalOpen(null);
                            setNewTableName("");
                            setNameError(null);
                          }}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleRenameSubmit}
                          disabled={
                            !newTableName.trim() || renameTable?.isPending
                          }
                          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {renameTable?.isPending ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Chevron dropdown for overflow (static for now) */}
        <button className="flex items-center justify-center rounded p-1.5 text-zinc-600 hover:bg-white/60">
          <ChevronDown className="h-4 w-4" />
        </button>

        <AddOrImportMenu baseId={baseId} onCreateTable={handleCreateTable} />

        <div className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
          <button className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/60">
            <span>Tools</span>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
