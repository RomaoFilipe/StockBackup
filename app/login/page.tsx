"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/authContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast"; // Import toast hook
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [lockedForSeconds, setLockedForSeconds] = useState(0);
  const { login, isLoggedIn, isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast(); // Use toast hook

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) return;

    const redirect = searchParams?.get("redirect");
    router.replace(redirect && redirect.startsWith("/") ? redirect : "/");
  }, [isAuthLoading, isLoggedIn, router, searchParams]);

  useEffect(() => {
    if (lockedForSeconds <= 0) return;
    const t = window.setInterval(() => {
      setLockedForSeconds((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [lockedForSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedForSeconds > 0) return;
    setIsLoading(true); // Start loading

    try {
      await login(email, password);

      // Show success toast
      toast({
        title: "Login Successful!",
        description: "Welcome back! Redirecting to dashboard...",
      });

      // Clear form
      setEmail("");
      setPassword("");

      const redirect = searchParams?.get("redirect");
      router.replace(redirect && redirect.startsWith("/") ? redirect : "/");
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === "string" ? error.response.data : null);

      const code = error?.response?.data?.code;
      const retryAfter = Number(error?.response?.data?.retryAfterSeconds || 0);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setLockedForSeconds(Math.trunc(retryAfter));
      }

      toast({
        title: "Login Failed",
        description:
          (code ? `${code}: ` : "") +
          (backendMsg || "Não foi possível efetuar login."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  return (
    <div className="min-h-svh bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto flex min-h-svh w-full max-w-md items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Entre com as suas credenciais para continuar.
              {isAuthLoading ? (
                <span className="mt-1 block">A verificar sessão...</span>
              ) : null}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="A sua password"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isAuthLoading || lockedForSeconds > 0}
                isLoading={isLoading}
              >
                {isLoading ? "A entrar..." : lockedForSeconds > 0 ? `Bloqueado (${lockedForSeconds}s)` : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-center text-sm text-muted-foreground">
              Precisa de acesso? Peça a um administrador para criar o utilizador.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
