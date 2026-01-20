"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type TableViewContextType = {
  searchBarOpen: boolean;
  setSearchBarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setSearchButtonRef: (ref: React.RefObject<HTMLButtonElement | null>) => void;
};

const TableViewContext = createContext<TableViewContextType | null>(null);

export function TableViewProvider({ children }: { children: ReactNode }) {
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchButtonRef, setSearchButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);

  return (
    <TableViewContext.Provider
      value={{
        searchBarOpen,
        setSearchBarOpen,
        searchQuery,
        setSearchQuery,
        searchButtonRef,
        setSearchButtonRef,
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
