import { auth } from "@/server/auth";

import HomeSidebar from "../_components/HomeComponents/HomeSidebar";
import HomeTopBar from "../_components/HomeComponents/HomeTopBar";

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NextAuth v5 — get session like this
  const session = await auth();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Top bar */}
      <HomeTopBar user={session?.user} />

      <div className="flex min-h-0 flex-1">
        <HomeSidebar />

        <main className="flex-1 overflow-auto bg-white px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
