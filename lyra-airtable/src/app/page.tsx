// import { CreateBaseDebug } from "./_components/CreateBaseDebug";
// import { TableDebug } from "./_components/TableDebug";

// export default function HomePage() {
//   return (
//     <main style={{ padding: 24 }}>
//       <h1>Lyra Airtable Clone</h1>
//       <CreateBaseDebug />
//       <TableDebug />
//     </main>
//   );
// }



import AppTopBar from "./_components/shell/AppTopBar";
import GridShell from "./_components/shell/GridShell";
import LeftRail from "./_components/shell/LeftRail";
import TableTabsBar from "./_components/shell/TableTabsBar";
import ViewActionBar from "./_components/shell/ViewActionBar";

export default function BasePage() {
  return (
    <div className="h-screen w-screen bg-white text-zinc-900">
      {/* Top app bar */}
      <AppTopBar />

      {/* Table tabs bar */}
      <TableTabsBar />

      {/* View/action bar */}
      <ViewActionBar />

      {/* Body */}
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