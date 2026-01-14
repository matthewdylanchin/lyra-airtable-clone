import AppTopBar from "@/app/_components/shell/AppTopBar";
import BaseSidebar from "@/app/_components/shell/BaseSidebar";
import LeftRail from "@/app/_components/shell/LeftRail";
import TableTabsBar from "@/app/_components/shell/TableTabsBar";
import ViewActionBar from "@/app/_components/shell/ViewActionBar";


export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <div className="flex h-full">
        {/* LEFT: vertical base sidebar */}
        <BaseSidebar />

        {/* RIGHT: everything else */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />
          <TableTabsBar />
          <ViewActionBar />

          {/* Main content area */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}