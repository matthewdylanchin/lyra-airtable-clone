import AppTopBar from "@/app/_components/shell/AppTopBar";
import GridShell from "@/app/_components/shell/GridShell";
import LeftRail from "@/app/_components/shell/LeftRail";
import TableTabsBar from "@/app/_components/shell/TableTabsBar";
import ViewActionBar from "@/app/_components/shell/ViewActionBar";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen bg-white text-zinc-900">
      <div className="flex flex-col">
        <AppTopBar />
        <TableTabsBar />
        <ViewActionBar />
      </div>
      <div className="flex h-[calc(100vh-44px-44px-44px)]">
        {/* Left rail */}
        <LeftRail />
        {/* Grid */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
