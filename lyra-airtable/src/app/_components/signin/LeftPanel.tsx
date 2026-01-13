// src/app/signin/_components/LeftPanel.tsx
import OAuthButtons from "./OAuthButtons";
import Image from "next/image";

export default function LeftPanel() {
  return (
    <div className="w-full max-w-[520px]">
      {/* Airtable-ish logo */}
      <div className="mb-8 flex items-center gap-3">
        <Image
          src="/airtable.png"
          alt="Airtable"
          width={36}
          height={36}
          className="h-9 w-9"
          priority
        />
      </div>

      <h1 className="text-[34px] tracking-[-0.02em] text-zinc-900">
        Sign in to Airtable
      </h1>

      <div className="mt-8">
        <label className="mb-2 block text-sm font-medium text-zinc-800">
          Email
        </label>

        <input
          placeholder="Email address"
          className="h-[44px] w-full rounded-md border border-zinc-100 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />

        <button className="mt-4 h-[44px] w-full rounded-md bg-blue-300 text-sm font-semibold text-white hover:bg-blue-500">
          Continue
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1" />
          <span className="text-sm text-zinc-500">or</span>
          <div className="h-px flex-1" />
        </div>

        <OAuthButtons />

        <div className="mt-10 text-sm text-zinc-600">
          New to Airtable?{" "}
          <a className="text-blue-600 hover:underline" href="#">
            {" "}
            Create an account
          </a>{" "}
          instead
        </div>
      </div>
    </div>
  );
}
