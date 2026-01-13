// src/app/signin/_components/SignInPage.tsx
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-[1280px] items-center justify-between px-10">
        <LeftPanel />
        <RightPanel />
      </div>
    </div>
  );
}