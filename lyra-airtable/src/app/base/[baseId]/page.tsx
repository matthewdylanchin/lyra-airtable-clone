import { redirect } from "next/navigation";
import { api } from "@/trpc/server";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;

  // 1️⃣ Auto updates lastOpenedAt because getById mutation triggers update
  await api.base.getById(baseId);

  // 2️⃣ Load tables
  const tables = await api.table.listByBase({ baseId });

  if (!tables.length) {
    redirect("/home");
  }

  redirect(`/base/${baseId}/table/${tables[0]!.id}`);
}
