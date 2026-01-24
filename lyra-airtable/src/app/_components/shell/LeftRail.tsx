"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  Sheet,
  Ellipsis,
  GripVertical,
  Trash2,
  Copy,
  Pencil,
} from "lucide-react";
import { useTableView } from "@/app/base/[baseId]/table/[tableId]/TableViewContext";
import { cn } from "@/lib/utils";

export default function LeftRail() {
  const {
    views,
    viewsLoading,
    currentViewId,
    setCurrentViewId,
    createView,
    deleteView,
    renameView,
    duplicateView,
  } = useTableView();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenViewId, setMenuOpenViewId] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter views by search
  const filteredViews = views.filter((view) =>
    view.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Focus input when creating
  useEffect(() => {
    if (isCreating) {
      createInputRef.current?.focus();
    }
  }, [isCreating]);

  // Focus input when editing
  useEffect(() => {
    if (editingViewId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingViewId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenViewId(null);
      }
    };

    if (menuOpenViewId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpenViewId]);

  const handleCreateView = async () => {
    if (!newViewName.trim()) {
      setIsCreating(false);
      setNewViewName("");
      return;
    }

    try {
      await createView(newViewName.trim());
      setIsCreating(false);
      setNewViewName("");
    } catch (error) {
      console.error("Failed to create view:", error);
    }
  };

  const handleRenameView = async (viewId: string) => {
    if (!editingName.trim()) {
      setEditingViewId(null);
      setEditingName("");
      return;
    }

    try {
      await renameView(viewId, editingName.trim());
      setEditingViewId(null);
      setEditingName("");
    } catch (error) {
      console.error("Failed to rename view:", error);
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (views.length <= 1) {
      alert("Cannot delete the last view");
      return;
    }

    try {
      await deleteView(viewId);
      setMenuOpenViewId(null);
    } catch (error) {
      console.error("Failed to delete view:", error);
    }
  };

  const handleDuplicateView = async (viewId: string) => {
    try {
      await duplicateView(viewId);
      setMenuOpenViewId(null);
    } catch (error) {
      console.error("Failed to duplicate view:", error);
    }
  };

  const startEditing = (view: { id: string; name: string }) => {
    setEditingViewId(view.id);
    setEditingName(view.name);
    setMenuOpenViewId(null);
  };

  return (
    <div className="flex h-full w-[280px] flex-col border-r border-zinc-200 bg-white">
      {/* Header */}
      <div className="p-3">
        <button
          onClick={() => {
            setIsCreating(true);
            setNewViewName("Grid view");
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100"
        >
          <Plus className="h-4 w-4 text-zinc-500" />
          <span className="font-medium">Create view</span>
        </button>

        <div className="relative mt-2">
          <Search className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find a view"
            className="w-full rounded-md border border-transparent bg-zinc-50 py-1.5 pr-2 pl-8 text-sm outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* View List */}
      <div className="flex-1 overflow-y-auto px-2">
        {viewsLoading ? (
          <div className="px-3 py-2 text-sm text-zinc-400">Loading...</div>
        ) : filteredViews.length === 0 && !isCreating ? (
          <div className="px-3 py-2 text-sm text-zinc-400">No views found</div>
        ) : (
          filteredViews.map((view) => (
            <div key={view.id} className="relative">
              {editingViewId === view.id ? (
                // Editing mode
                <div className="flex items-center gap-2 rounded-md px-3 py-2">
                  <Sheet className="h-4 w-4 flex-shrink-0 text-blue-600" />
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRenameView(view.id);
                      } else if (e.key === "Escape") {
                        setEditingViewId(null);
                        setEditingName("");
                      }
                    }}
                    onBlur={() => handleRenameView(view.id)}
                    className="flex-1 rounded border border-blue-500 px-1 py-0.5 text-sm outline-none"
                  />
                </div>
              ) : (
                // Normal mode
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setCurrentViewId(view.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setCurrentViewId(view.id);
                    }
                  }}
                  className={cn(
                    "group flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100",
                    currentViewId === view.id && "bg-blue-50 text-blue-700",
                  )}
                >
                  {/* Left: icon + label */}
                  <div className="flex items-center gap-2">
                    <Sheet
                      className={cn(
                        "h-4 w-4",
                        currentViewId === view.id
                          ? "text-blue-600"
                          : "text-zinc-400",
                      )}
                    />
                    <span className="truncate">{view.name}</span>
                  </div>

                  {/* Right: hover actions */}
                  <div
                    className={cn(
                      "flex items-center gap-1 transition-opacity",
                      currentViewId === view.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-zinc-200"
                      aria-label="View options"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenViewId(
                          menuOpenViewId === view.id ? null : view.id,
                        );
                      }}
                    >
                      <Ellipsis className="h-4 w-4 text-zinc-500" />
                    </button>

                    <button
                      type="button"
                      className="cursor-grab rounded p-1 hover:bg-zinc-200"
                      aria-label="Reorder view"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4 text-zinc-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Dropdown Menu */}
              {menuOpenViewId === view.id && (
                <div
                  ref={menuRef}
                  className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
                >
                  <button
                    onClick={() => startEditing(view)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                    Rename view
                  </button>
                  <button
                    onClick={() => handleDuplicateView(view.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate view
                  </button>
                  <hr className="my-1 border-zinc-200" />
                  <button
                    onClick={() => handleDeleteView(view.id)}
                    disabled={views.length <= 1}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete view
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {/* Create new view input */}
        {isCreating && (
          <div className="flex items-center gap-2 rounded-md px-3 py-2">
            <Sheet className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <input
              ref={createInputRef}
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateView();
                } else if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewViewName("");
                }
              }}
              onBlur={handleCreateView}
              placeholder="View name"
              className="flex-1 rounded border border-blue-500 px-1 py-0.5 text-sm outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
