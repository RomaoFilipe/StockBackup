"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/authContext";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const { login, isLoggedIn, isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast(); // Use toast hook
  const [spotlight, setSpotlight] = useState({ x: 50, y: 28 });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) return;

    const redirect = searchParams?.get("redirect");
    router.replace(redirect && redirect.startsWith("/") ? redirect : "/");
  }, [isAuthLoading, isLoggedIn, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("login_email");
    if (saved) setEmail(saved);

    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(Boolean(mql?.matches));
    update();
    if (!mql) return;
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rememberEmail) {
      window.localStorage.removeItem("login_email");
      return;
    }
    if (email.trim()) window.localStorage.setItem("login_email", email.trim());
  }, [email, rememberEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reduceMotion) return;

    let raf = 0;
    const onMove = (ev: MouseEvent) => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const x = Math.max(0, Math.min(100, (ev.clientX / window.innerWidth) * 100));
        const y = Math.max(0, Math.min(100, (ev.clientY / window.innerHeight) * 100));
        setSpotlight({ x, y });
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove as any);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

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
      if (!rememberEmail) setEmail("");
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
    <div className="relative min-h-svh overflow-hidden bg-background">
      {/* Background image layer (swap this asset later if you want a dedicated login background) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={
          {
            "--sx": `${spotlight.x}%`,
            "--sy": `${spotlight.y}%`,
          } as React.CSSProperties
        }
      >
        <Image
          src="/background.png"
          alt=""
          fill
          priority
          className="object-cover opacity-[0.55] saturate-[1.08] contrast-[1.05]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/35 to-background/65" />
        <div className="login-grid absolute inset-0 opacity-[0.35]" />
        <div className="login-blobs absolute inset-0" />
        <div className="login-spotlight absolute inset-0" />
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-md items-center px-4 py-10">
        <div className="w-full space-y-4">
          <div className="flex flex-col items-center justify-center">
            <Image
              src="/branding/logo2.png"
              alt="CMCHUB"
              width={320}
              height={96}
              priority
              className="h-14 w-auto drop-shadow-sm sm:h-16"
            />
            <div className="mt-1 text-xs text-muted-foreground">Municipal Operations Hub</div>
          </div>

          <Card className="login-card w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Login</CardTitle>
              <CardDescription>
                Entre com as suas credenciais para continuar.
                {isAuthLoading ? <span className="mt-1 block">A verificar sessão...</span> : null}
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
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={(e) => setCapsLockOn(Boolean((e as any).getModifierState?.("CapsLock")))}
                      onKeyDown={(e) => setCapsLockOn(Boolean((e as any).getModifierState?.("CapsLock")))}
                      placeholder="A sua password"
                      autoComplete="current-password"
                      required
                      disabled={isLoading}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      disabled={isLoading}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {capsLockOn ? <div className="text-xs text-amber-600 dark:text-amber-400">Caps Lock está ligado.</div> : null}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="flex select-none items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      disabled={isLoading}
                    />
                    Lembrar email
                  </label>
                  {lockedForSeconds > 0 ? <div className="text-xs text-muted-foreground">Tenta novamente em {lockedForSeconds}s</div> : null}
                </div>

                <Button type="submit" className="w-full" disabled={isAuthLoading || lockedForSeconds > 0} isLoading={isLoading}>
                  {isLoading ? "A entrar..." : lockedForSeconds > 0 ? `Bloqueado (${lockedForSeconds}s)` : "Login"}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="justify-center">
              <p className="text-center text-sm text-muted-foreground">Precisa de acesso? Peça a um administrador para criar o utilizador.</p>
            </CardFooter>
          </Card>
        </div>
      </div>

      <style jsx>{`
        .login-card {
          position: relative;
          overflow: hidden;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background) / 0.82);
          backdrop-filter: blur(14px);
        }

        .login-card::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 16px;
          background: conic-gradient(
            from 180deg,
            transparent 0deg,
            hsl(var(--primary) / 0.25) 80deg,
            hsl(var(--primary) / 0.08) 160deg,
            transparent 240deg,
            transparent 360deg
          );
          filter: blur(10px);
          opacity: ${reduceMotion ? 0 : 0.9};
          animation: ${reduceMotion ? "none" : "spin 10s linear infinite"};
          pointer-events: none;
        }

        .login-grid {
          background-image: linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border) / 0.25) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(circle at 50% 30%, black 0%, transparent 65%);
        }

        .login-blobs {
          background:
            radial-gradient(600px circle at 15% 20%, hsl(var(--primary) / 0.14), transparent 55%),
            radial-gradient(520px circle at 80% 10%, hsl(var(--primary) / 0.10), transparent 60%),
            radial-gradient(740px circle at 70% 85%, hsl(var(--primary) / 0.12), transparent 55%);
          filter: blur(2px);
          transform: translateZ(0);
          animation: ${reduceMotion ? "none" : "float 14s ease-in-out infinite"};
          opacity: 0.9;
        }

        .login-spotlight {
          background: radial-gradient(520px circle at var(--sx, 50%) var(--sy, 30%), hsl(var(--primary) / 0.18), transparent 60%);
          mix-blend-mode: soft-light;
          opacity: ${reduceMotion ? 0 : 0.9};
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -10px, 0);
          }
        }
      `}</style>
    </div>
  );
}
