"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Register() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="w-full max-w-md p-8 space-y-4">
        <h2 className="text-2xl font-bold">Registo desativado</h2>
        <p className="text-sm text-muted-foreground">
          Este é um sistema interno. As contas são criadas por um administrador.
        </p>

        <Button asChild className="w-full">
          <Link href="/login">Ir para Login</Link>
        </Button>
      </div>
    </div>
  );
}
