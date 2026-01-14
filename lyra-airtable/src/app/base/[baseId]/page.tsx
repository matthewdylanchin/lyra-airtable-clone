import { redirect } from "next/navigation";
import { api } from "@/trpc/server";

export default async function BasePage({
  params,
}: {
  params: { baseId: string };
}) {
  const tables = await api.table.listByBase({
    baseId: params.baseId,
  });

  if (!tables.length) {
    return redirect("/home");
  }
  redirect(`/base/${params.baseId}/table/${tables[0]!.id}`);
}
