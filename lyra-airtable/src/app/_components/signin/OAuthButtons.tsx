// src/app/signin/_components/OAuthButtons.tsx
"use client";
import Image from "next/image";
import { signIn } from "next-auth/react";

function ProviderButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[44px] w-full items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

export default function OAuthButtons() {
  return (
    <div className="space-y-3">
      <ProviderButton>
        <span className="inline-flex items-center gap-[4px]">
  <span>Sign in with</span>
  <span className="font-bold">Single Sign On</span>
</span>
      </ProviderButton>

      <ProviderButton onClick={() => signIn("google", { callbackUrl: "/" })}>
        <Image src="/google.png" alt="Google" width={18} height={18} />
        <span className="inline-flex items-center gap-[4px]">
          <span>Continue with</span>
          <span className="font-bold">Google</span>
        </span>
      </ProviderButton>

      <ProviderButton>
        <span className="text-zinc-900">
          <Image src="/apple.svg" alt="Apple" width={15} height={15} />
        </span>
        <span className="inline-flex items-center gap-[4px]">
          <span>Continue with</span>
          <span className="font-bold">Apple ID</span>
        </span>
      </ProviderButton>
    </div>
  );
}
