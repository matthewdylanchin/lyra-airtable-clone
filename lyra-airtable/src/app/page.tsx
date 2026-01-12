import AppTopBar from "./_components/shell/AppTopBar";
import GridShell from "./_components/shell/GridShell";
import LeftRail from "./_components/shell/LeftRail";
import TableTabsBar from "./_components/shell/TableTabsBar";
import ViewActionBar from "./_components/shell/ViewActionBar";

export default function BasePage() {
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
        <div className="flex-1 overflow-hidden">
          <GridShell />
        </div>
      </div>
    </div>
  );
}
