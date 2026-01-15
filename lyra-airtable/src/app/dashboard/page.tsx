import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getServerAuthSession } from "@/server/auth";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin");

  const bases = await db.base.findMany({
    where: { ownerId: session.user.id },
    orderBy: { lastOpenedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      lastOpenedAt: true,
    },
    take: 1,
  });

  // If user has no bases yet, send them somewhere that creates one
  // (temporary: you can make /dashboard/new later)
  if (bases.length === 0) {
    redirect("/dashboard/new");
  }

  redirect(`/base/${bases[0]!.id}`);
}
