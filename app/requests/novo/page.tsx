"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/authContext";

export default function NewRequestEntry() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login?redirect=/requests");
      return;
    }
    if (user?.role === "USER") {
      router.replace("/requests/estado/novo");
      return;
    }
    router.replace("/requests?openCreate=1");
  }, [isAuthLoading, isLoggedIn, router, user?.role]);

  return null;
}
