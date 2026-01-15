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
        {/* LEFT RAIL (icons: home, automations, interfaces, forms, etc.) */}
        <BaseSidebar />

        {/* LEFT: vertical base sidebar */}

        {/* RIGHT: everything else */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />
          <TableTabsBar />
          <ViewActionBar />

          <div className="flex h-[calc(100vh-44px-44px-44px)]">
            {/* LEFTMOST: BaseSidebar (super thin bar with icons) */}
            {/* SECOND: LeftRail (view list, grid view, etc.) */}
            <LeftRail />

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
