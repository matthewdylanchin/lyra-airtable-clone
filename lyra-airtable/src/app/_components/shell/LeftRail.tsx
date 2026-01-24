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
  Loader2,
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
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenViewId, setMenuOpenViewId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeletingViewId, setIsDeletingViewId] = useState<string | null>(null); // ✅ Track which view is being deleted
  const [isDuplicatingViewId, setIsDuplicatingViewId] = useState<string | null>(
    null,
  ); // ✅ Track which view is being duplicated
  const [isRenaming, setIsRenaming] = useState(false); // ✅ Track rename in progress

  const createButtonRef = useRef<HTMLButtonElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Filter views by search
  const filteredViews = views.filter((view) =>
    view.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Generate next grid name based on view count
  const getNextGridName = () => {
    const count = views.length;
    if (count === 0) {
      return "Grid view";
    }
    return `Grid ${count + 1}`;
  };

  // Focus input when popup opens
  useEffect(() => {
    if (isPopupOpen) {
      setTimeout(() => {
        createInputRef.current?.focus();
        createInputRef.current?.select();
      }, 50);
    }
  }, [isPopupOpen]);

  // Focus input when editing
  useEffect(() => {
    if (editingViewId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingViewId]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !createButtonRef.current?.contains(e.target as Node)
      ) {
        setIsPopupOpen(false);
      }
    };

    if (isPopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isPopupOpen]);

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

  const openCreatePopup = () => {
    setNewViewName(getNextGridName());
    setIsPopupOpen(true);
  };

  const handleCreateView = async () => {
    if (!newViewName.trim() || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      await createView(newViewName.trim());
      setIsPopupOpen(false);
      setNewViewName("");
    } catch (error) {
      console.error("Failed to create view:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameView = async (viewId: string) => {
    if (!editingName.trim() || isRenaming) {
      setEditingViewId(null);
      setEditingName("");
      return;
    }

    setIsRenaming(true);
    try {
      await renameView(viewId, editingName.trim());
      setEditingViewId(null);
      setEditingName("");
    } catch (error) {
      console.error("Failed to rename view:", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteView = async (viewId: string) => {
    // ✅ Guard: prevent double-click
    if (isDeletingViewId) {
      return;
    }

    if (views.length <= 1) {
      alert("Cannot delete the last view");
      return;
    }

    setIsDeletingViewId(viewId);
    try {
      await deleteView(viewId);
      setMenuOpenViewId(null);
    } catch (error) {
      console.error("Failed to delete view:", error);
    } finally {
      setIsDeletingViewId(null);
    }
  };

  const handleDuplicateView = async (viewId: string) => {
    // ✅ Guard: prevent double-click
    if (isDuplicatingViewId) {
      return;
    }

    setIsDuplicatingViewId(viewId);
    try {
      await duplicateView(viewId);
      setMenuOpenViewId(null);
    } catch (error) {
      console.error("Failed to duplicate view:", error);
    } finally {
      setIsDuplicatingViewId(null);
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
      <div className="relative p-3">
        <button
          ref={createButtonRef}
          onClick={openCreatePopup}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100"
        >
          <Plus className="h-4 w-4 text-zinc-500" />
          <span className="font-medium">Create new...</span>
        </button>

        {/* Create View Popup */}
        {isPopupOpen && (
          <div
            ref={popupRef}
            className="absolute top-0 left-full z-50 ml-2 w-[340px] rounded-lg border border-zinc-200 bg-white p-4 shadow-xl"
          >
            {/* Name input */}
            <div className="mb-4">
              <input
                ref={createInputRef}
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    void handleCreateView();
                  } else if (e.key === "Escape") {
                    setIsPopupOpen(false);
                  }
                }}
                placeholder="View name"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Who can edit section */}
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-700">
                Who can edit
              </h3>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="editPermission"
                    value="collaborative"
                    defaultChecked
                    className="h-3.5 w-3.5 text-blue-600"
                  />
                  <span className="text-sm text-zinc-700">Collaborative</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="editPermission"
                    value="personal"
                    disabled
                    className="h-3.5 w-3.5 text-blue-600"
                  />
                  <span className="text-sm text-zinc-400">Personal</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="editPermission"
                    value="locked"
                    disabled
                    className="h-3.5 w-3.5 text-blue-600"
                  />
                  <span className="text-sm text-zinc-400">Locked</span>
                </label>
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                All collaborators can edit the configuration
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsPopupOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateView}
                disabled={!newViewName.trim() || isCreating}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create new view"}
              </button>
            </div>
          </div>
        )}

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
        ) : filteredViews.length === 0 ? (
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
                        void handleRenameView(view.id);
                      } else if (e.key === "Escape") {
                        setEditingViewId(null);
                        setEditingName("");
                      }
                    }}
                    onBlur={() => void handleRenameView(view.id)}
                    disabled={isRenaming}
                    className="flex-1 rounded border border-blue-500 px-1 py-0.5 text-sm outline-none disabled:opacity-50"
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
                    currentViewId === view.id && "bg-blue-50 text-zinc-700",
                    isDeletingViewId === view.id && "opacity-50",
                  )}
                >
                  {/* Left: icon + label */}
                  <div className="flex items-center gap-2">
                    {isDeletingViewId === view.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    ) : (
                      <Sheet
                        className={cn(
                          "h-4 w-4",
                          currentViewId === view.id
                            ? "text-blue-600"
                            : "text-blue-600",
                        )}
                      />
                    )}
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
                    disabled={!!isDuplicatingViewId}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDuplicatingViewId === view.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {isDuplicatingViewId === view.id
                      ? "Duplicating..."
                      : "Duplicate view"}
                  </button>
                  <hr className="my-1 border-zinc-200" />
                  <button
                    onClick={() => handleDeleteView(view.id)}
                    disabled={views.length <= 1 || !!isDeletingViewId}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeletingViewId === view.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {isDeletingViewId === view.id
                      ? "Deleting..."
                      : "Delete view"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
