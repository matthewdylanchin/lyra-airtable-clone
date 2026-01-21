"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { FilterCondition } from "./types";

type TableViewContextType = {
  searchBarOpen: boolean;
  setSearchBarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setSearchButtonRef: (ref: React.RefObject<HTMLButtonElement | null>) => void;

  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
  filterButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setFilterButtonRef: (ref: React.RefObject<HTMLButtonElement | null>) => void;

  filters: FilterCondition[];
  setFilters: (filters: FilterCondition[]) => void;
  filterConjunction: "and" | "or";
  setFilterConjunction: (mode: "and" | "or") => void;
};

const TableViewContext = createContext<TableViewContextType | null>(null);

export function TableViewProvider({ children }: { children: ReactNode }) {
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchButtonRef, setSearchButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterButtonRef, setFilterButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);

  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterConjunction, setFilterConjunction] = useState<"and" | "or">(
    "and",
  );

  return (
    <TableViewContext.Provider
      value={{
        searchBarOpen,
        setSearchBarOpen,
        searchQuery,
        setSearchQuery,
        searchButtonRef,
        setSearchButtonRef,
        filterPanelOpen,
        setFilterPanelOpen,
        filterButtonRef,
        setFilterButtonRef,
        filters,
        setFilters,
        filterConjunction,
        setFilterConjunction,
      }}
    >
      {children}
    </TableViewContext.Provider>
  );
}

export function useTableView() {
  const context = useContext(TableViewContext);
  if (!context) {
    throw new Error("useTableView must be used within TableViewProvider");
  }
  return context;
}
