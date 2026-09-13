"use client";

import LoaderUI from "@/components/LoaderUI";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isInterviewer, isLoading } = useUserRole();

  if (isLoading) return <LoaderUI />;
  if (!isInterviewer) {
    router.push("/");
    return null;
  }

  return <>{children}</>;
}
