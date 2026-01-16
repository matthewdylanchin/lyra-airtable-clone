"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/trpc/react";
import { createPortal } from "react-dom";
import {
  Plus,
  Type,
  Hash,
  Link2,
  CheckSquare,
  List,
  User,
  Calendar,
  Phone,
  Mail,
  Link,
  DollarSign,
  Percent,
  Clock,
  Star,
  Image,
  FileCode,
  Search,
  StickyNote,
  Building2,
  MousePointer,
  MessageSquareMore,
  Grid2X2,
  TextInitial,
  CircleArrowDown,
} from "lucide-react";
import type { ColumnInsertPosition } from "../types";

// Field agents (AI features) with colors
const fieldAgents = [
  {
    label: "Analyze attachment",
    icon: <StickyNote size={16} />,
    iconColor: "text-emerald-600",
    hoverBg: "hover:bg-emerald-50",
    disabled: true,
  },
  {
    label: "Research companies",
    icon: <Building2 size={16} />,
    iconColor: "text-blue-600",
    hoverBg: "hover:bg-blue-50",
    disabled: true,
  },
  {
    label: "Find image from web",
    icon: <Image size={16} />,
    iconColor: "text-purple-600",
    hoverBg: "hover:bg-purple-50",
    disabled: true,
  },
  {
    label: "Generate image",
    icon: <Image size={16} />,
    iconColor: "text-orange-600",
    hoverBg: "hover:bg-orange-50",
    disabled: true,
  },
  {
    label: "Categorize assets",
    icon: <FileCode size={16} />,
    iconColor: "text-orange-600",
    hoverBg: "hover:bg-orange-50",
    disabled: true,
  },
  {
    label: "Build prototype",
    icon: <MousePointer size={16} />,
    iconColor: "text-violet-600",
    hoverBg: "hover:bg-violet-50",
    disabled: true,
  },
  {
    label: "Build a field agent",
    icon: <MessageSquareMore size={16} />,
    iconColor: "text-emerald-800",
    hoverBg: "hover:bg-emerald-50",
    disabled: true,
  },
  {
    label: "Browse catalog",
    icon: <Grid2X2 size={16} />,
    iconColor: "text-zinc-800",
    hoverBg: "hover:bg-zinc-50",
    disabled: true,
  },
];

// Standard fields
const standardFields = [
  {
    label: "Link to another record",
    icon: <Link2 size={16} />,
    type: null,
    disabled: true,
  },
  { label: "Single line text", icon: <Type size={16} />, type: "TEXT" },
  { label: "Long text", icon: <TextInitial size={16} />, type: "TEXT" },
  {
    label: "Attachment",
    icon: <StickyNote size={16} />,
    type: null,
    disabled: true,
  },
  {
    label: "Checkbox",
    icon: <CheckSquare size={16} />,
    type: null,
    disabled: true,
  },
  {
    label: "Multiple select",
    icon: <List size={16} />,
    type: null,
    disabled: true,
  },
  {
    label: "Single select",
    icon: <CircleArrowDown size={16} />,
    type: null,
    disabled: true,
  },
  { label: "User", icon: <User size={16} />, type: null, disabled: true },
  { label: "Date", icon: <Calendar size={16} />, type: null, disabled: true },
  {
    label: "Phone number",
    icon: <Phone size={16} />,
    type: null,
    disabled: true,
  },
  { label: "Email", icon: <Mail size={16} />, type: null, disabled: true },
  { label: "URL", icon: <Link size={16} />, type: null, disabled: true },
  { label: "Number", icon: <Hash size={16} />, type: "NUMBER" },
  {
    label: "Currency",
    icon: <DollarSign size={16} />,
    type: null,
    disabled: true,
  },
  { label: "Percent", icon: <Percent size={16} />, type: null, disabled: true },
  { label: "Duration", icon: <Clock size={16} />, type: null, disabled: true },
  { label: "Rating", icon: <Star size={16} />, type: null, disabled: true },
];

export default function AddColumnButton({
  tableId,
  insert = { type: "end" },
  onClose,
  autoOpen = false,
  targetColumnRef,
  initialPosition,
}: {
  tableId: string;
  insert?: ColumnInsertPosition;
  onClose?: () => void;
  autoOpen?: boolean;
  targetColumnRef?: React.RefObject<HTMLElement | null>;
  initialPosition?: { top: number; left: number };
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "form">("menu");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"TEXT" | "NUMBER" | null>(
    null,
  );
  const [colName, setColName] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  // Check if mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  const createColumn = api.column.create.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
      reset();
    },
    onError: (error) => {
      console.error("Create column error:", error);
    },
  });

  const insertColumn = api.column.insertAtPosition.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
      reset();
    },
    onError: (error) => {
      console.error("Insert column error:", error);
    },
  });

  function reset() {
    setOpen(false);
    setColName("");
    setSelectedType(null);
    setStep("menu");
    setSearch("");
    onClose?.();
  }

  useEffect(() => {
    if (autoOpen && mounted) {
      setTimeout(() => setOpen(true), 100);
    }
  }, [autoOpen, mounted]);

  // ✅ Use initialPosition if provided (from context menu), otherwise calculate from ref
  useEffect(() => {
    if (!open) return;

    const calculatePosition = () => {
      const menuWidth = 320;
      const menuHeight = 600;
      const padding = 16;

      let top: number;
      let left: number;

      // If we have a pre-calculated position, use it
      if (initialPosition) {
        top = initialPosition.top;
        left = initialPosition.left;
      } else {
        // Calculate from ref (for regular "+" button clicks)
        const refToUse = targetColumnRef?.current ?? buttonRef.current;
        if (!refToUse) return;

        const rect = refToUse.getBoundingClientRect();
        top = rect.bottom + 8;
        left = rect.left;
      }

      // Adjust if menu would go off right edge
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }

      // Ensure menu doesn't go off left edge
      left = Math.max(padding, left);

      // Adjust if menu would go off bottom
      if (top + menuHeight > window.innerHeight - padding) {
        // If we have initialPosition, try positioning above
        if (initialPosition) {
          top = initialPosition.top - menuHeight - 8;
        }

        // If still off screen, pin to bottom
        if (top < padding) {
          top = window.innerHeight - menuHeight - padding;
        }
      }

      // Ensure it doesn't go off top
      top = Math.max(padding, top);

      setDropdownPosition({ top, left });
    };

    calculatePosition();

    const timeoutId = setTimeout(calculatePosition, 10);

    window.addEventListener("scroll", calculatePosition, true);
    window.addEventListener("resize", calculatePosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", calculatePosition, true);
      window.removeEventListener("resize", calculatePosition);
    };
  }, [open, targetColumnRef, initialPosition]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        reset();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  useEffect(() => {
    if (open && step === "menu" && mounted) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open, step, mounted]);

  useEffect(() => {
    if (step === "form" && mounted) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [step, mounted]);

  const filteredAgents = fieldAgents.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredFields = standardFields.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase()),
  );

  function handleCreateColumn() {
    if (!selectedType || colName.trim() === "" || !mounted) return;

    const columnData = {
      tableId,
      name: colName.trim(),
      type: selectedType,
    };

    console.log("Creating column:", { insert, columnData });

    if (insert.type === "before" || insert.type === "after") {
      if (!insert.columnId) {
        console.error("Missing columnId for insert position");
        return;
      }

      void insertColumn.mutate({
        tableId: columnData.tableId,
        anchorColumnId: insert.columnId,
        position: insert.type,
        name: columnData.name,
        type: columnData.type,
      });
    } else {
      void createColumn.mutate(columnData);
    }
  }

  const dropdownContent = (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-80 rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
      }}
    >
      {step === "menu" && (
        <div className="flex max-h-[600px] flex-col">
          <div className="border-b border-zinc-200 p-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400"
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a field type"
                className="w-full rounded-md border border-zinc-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-y-auto px-3 py-2">
            {filteredAgents.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 px-2 text-xs font-semibold text-zinc-500">
                  Field agents
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredAgents.map((agent) => (
                    <button
                      key={agent.label}
                      disabled={agent.disabled}
                      className={`flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-left text-sm text-zinc-700 transition ${agent.hoverBg} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className={agent.iconColor}>{agent.icon}</span>
                      <span className="text-xs">{agent.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredFields.length > 0 && (
              <div>
                <div className="mb-2 px-2 text-xs font-semibold text-zinc-500">
                  Standard fields
                </div>
                <div className="space-y-0.5">
                  {filteredFields.map((field) => (
                    <button
                      key={field.label}
                      disabled={field.disabled}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        if (!field.disabled && field.type) {
                          setSelectedType(field.type as "TEXT" | "NUMBER");
                          setStep("form");
                        }
                      }}
                    >
                      <span className="text-zinc-600">{field.icon}</span>
                      <span>{field.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredAgents.length === 0 && filteredFields.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-500">
                No field types found
              </div>
            )}
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-500 uppercase">
            Create field
          </div>

          <input
            ref={inputRef}
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateColumn();
              } else if (e.key === "Escape") {
                e.preventDefault();
                reset();
              }
            }}
            placeholder="Field name"
            className="mb-3 w-full rounded-md border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            disabled
            placeholder="Enter default value (optional)"
            className="mb-4 w-full cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setStep("menu");
                setSelectedType(null);
                setColName("");
              }}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>

            <button
              onClick={handleCreateColumn}
              disabled={
                !selectedType ||
                colName.trim() === "" ||
                insertColumn.isPending ||
                createColumn.isPending
              }
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {insertColumn.isPending || createColumn.isPending
                ? "Creating..."
                : "Create field"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-zinc-100"
      >
        <Plus size={16} />
      </button>

      {open && mounted && createPortal(dropdownContent, document.body)}
    </>
  );
}
