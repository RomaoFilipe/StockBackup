"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppTable from "./AppTable/AppTable";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import { useAuth } from "./authContext";

const Home = React.memo(() => {
  const router = useRouter();
  const { user, isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading) return;
    if (user?.role === "USER") {
      router.replace("/requests/estado");
    }
  }, [isAuthLoading, user?.role, router]);

  if (user?.role === "USER") {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <AppTable />
    </AuthenticatedLayout>
  );
});

Home.displayName = 'Home';

export default Home;
