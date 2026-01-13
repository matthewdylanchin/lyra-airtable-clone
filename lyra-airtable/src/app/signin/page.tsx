// src/app/signin/page.tsx
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import SignInPage from "../_components/signin/SignInPage";

export default async function SignIn() {
  const session = await getServerAuthSession();
  if (session) redirect("/");

  return <SignInPage />;
}