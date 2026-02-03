"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import Loading from "@/components/Loading";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axiosInstance.post("/auth/register", {
        name, // ✅ backend exige "name"
        email,
        password,
      });

      if (response.status === 201) {
        toast({
          title: "Conta criada com sucesso!",
          description: "A redirecionar para a página de login...",
        });

        // Limpar form
        setName("");
        setEmail("");
        setPassword("");

        // Redirecionar
        setTimeout(() => {
          router.push("/login");
        }, 1200);

        return;
      }

      throw new Error("Registration failed");
    } catch (error: any) {
      // Tenta mostrar mensagem vinda do backend (Zod/validação)
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        (typeof error?.response?.data === "string" ? error.response.data : null);

      const details = error?.response?.data?.details;
      const fieldErrors = details?.fieldErrors;

      const fieldMsg =
        fieldErrors && typeof fieldErrors === "object"
          ? Object.entries(fieldErrors)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join(" | ")
          : null;

      toast({
        title: "Registo falhou",
        description:
          fieldMsg ||
          backendMsg ||
          error?.message ||
          "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 space-y-4"
      >
        <h2 className="text-2xl font-bold">Register</h2>

        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
        />

        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />

        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loading /> Creating Account...
            </span>
          ) : (
            "Register"
          )}
        </Button>

        <div className="text-center">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="text-blue-500">
              Login
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
