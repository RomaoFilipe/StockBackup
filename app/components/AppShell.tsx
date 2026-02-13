"use client";

import React, { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  Boxes,
  Database,
  LayoutGrid,
  ScanLine,
  LogOut,
  Menu,
  Package,
  Users,
  Plus,
  FileText,
  Rows3,
  StretchHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/app/authContext";
import { ModeToggle } from "@/app/AppHeader/ModeToggle";
import { RequestsNotificationsBell } from "@/app/AppHeader/RequestsNotificationsBell";

interface AppShellProps {
  children: React.ReactNode;
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  active?: (pathname: string, searchParams: ReadonlyURLSearchParams | null) => boolean;
};

const navItemsBase: NavItem[] = [
  {
    label: "Produtos",
    href: "/",
    icon: Package,
  },
  {
    label: "Requisições",
    href: "/requests",
    icon: LayoutGrid,
  },
  {
    label: "Equipamentos",
    href: "/equipamentos",
    icon: Boxes,
  },
  {
    label: "Storage",
    href: "/storage",
    icon: Archive,
    active: (pathname, searchParams) =>
      pathname === "/storage" && searchParams?.get("tab") !== "documents",
  },
  {
    label: "Scan",
    href: "/scan",
    icon: ScanLine,
  },
  {
    label: "Insights",
    href: "/business-insights",
    icon: BarChart3,
  },
  {
    label: "Documentação API",
    href: "/api-docs",
    icon: BookOpen,
  },
  {
    label: "Estado da API",
    href: "/api-status",
    icon: Activity,
  },
];

const navItemsUserOnly: NavItem[] = [
  {
    label: "Estado do Pedido",
    href: "/requests/estado",
    icon: FileText,
  },
  {
    label: "Novo Pedido",
    href: "/requests/novo",
    icon: Plus,
  },
];

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [pwOpen, setPwOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changing, setChanging] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  React.useEffect(() => {
    const stored = window.localStorage.getItem("ui-density");
    if (stored === "compact") {
      setDensity("compact");
    }
  }, []);

  React.useEffect(() => {
    const isCompact = density === "compact";
    document.documentElement.classList.toggle("density-compact", isCompact);
    window.localStorage.setItem("ui-density", density);
  }, [density]);

  const navItems = useMemo(() => {
    // USER (desktop/sidebar)
    if (user?.role === "USER") {
      return [...navItemsUserOnly];
    }

    // ADMIN (desktop/sidebar)
    const items = [...navItemsBase];
    
    if (user?.role === "ADMIN") {
      const scanIndex = items.findIndex((i) => i.href === "/scan");
      const insertDbAt = scanIndex >= 0 ? scanIndex : items.length;
      items.splice(insertDbAt, 0, {
        label: "DB",
        href: "/DB",
        icon: Database,
      });

      const insightsIndex = items.findIndex((i) => i.href === "/business-insights");
      const insertUsersAt = insightsIndex >= 0 ? insightsIndex : items.length;
      items.splice(insertUsersAt, 0, {
        label: "Pessoas",
        href: "/users",
        icon: Users,
      });
    }

    // Keep access to request state/new on desktop too
    items.push(...navItemsUserOnly);

    return items;
  }, [user?.role]);

  const mobilePrimaryNav = useMemo<NavItem[]>(() => {
    if (user?.role === "USER") {
      return [
        { label: "Estado do Pedido", href: "/requests/estado", icon: FileText },
        { label: "Novo Pedido", href: "/requests/novo", icon: Plus },
      ];
    }

    // Admin: Scan fixed in the middle
    return [
      { label: "Produtos", href: "/", icon: Package },
      { label: "Requisições", href: "/requests", icon: LayoutGrid },
      { label: "Scan", href: "/scan", icon: ScanLine },
      { label: "Equipamentos", href: "/equipamentos", icon: Boxes },
    ];
  }, [user?.role]);

  const mobileSecondaryNav = useMemo<NavItem[]>(() => {
    if (user?.role === "USER") return [];
    return [
      {
        label: "Storage",
        href: "/storage",
        icon: Archive,
        active: (pathname, searchParams) =>
          pathname === "/storage" && searchParams?.get("tab") !== "documents",
      },
      { label: "DB", href: "/DB", icon: Database },
      { label: "Estado do Pedido", href: "/requests/estado", icon: FileText },
      { label: "Novo Pedido", href: "/requests/novo", icon: Plus },
      { label: "Pessoas", href: "/users", icon: Users },
      { label: "Insights", href: "/business-insights", icon: BarChart3 },
      { label: "Documentação API", href: "/api-docs", icon: BookOpen },
      { label: "Estado da API", href: "/api-status", icon: Activity },
    ];
  }, [user?.role]);

  const isActive = (item: NavItem) => {
    if (item.active) return item.active(pathname || "", searchParams);
    if (!pathname) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast({
        title: "Sessão terminada",
        description: "Terminaste sessão com sucesso.",
      });
      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch (error) {
      toast({
        title: "Falha ao terminar sessão",
        description: "Não foi possível terminar a sessão. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  React.useEffect(() => {
    if (user?.mustChangePassword) {
      setPwOpen(true);
    }
  }, [user?.mustChangePassword]);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Erro", description: "Password precisa ter pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "Passwords não coincidem.", variant: "destructive" });
      return;
    }
    setChanging(true);
    try {
      await axiosInstance.post("/users/change-password", { password: newPassword });
      toast({ title: "Senha atualizada", description: "A sua senha foi alterada com sucesso." });
      setPwOpen(false);
      // Refresh the session/user state simply by reloading
      window.location.reload();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível alterar a password.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="app-mesh-bg" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_20%_-10%,hsl(var(--primary)/0.18),transparent_45%),radial-gradient(900px_circle_at_85%_0%,hsl(var(--ring)/0.14),transparent_40%)]" />

      <div className="flex min-h-screen min-w-0">
        <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-border/50 lg:bg-[hsl(var(--surface-1)/0.82)] lg:backdrop-blur-xl">
          <div className="flex items-center gap-3 px-6 py-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/16 text-primary electric-ring">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Stockly</div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Inventory Suite</div>
            </div>
          </div>

          <nav className="flex-1 space-y-4 px-4 pb-6">
            <div className="space-y-1 animate-fade-up">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleNavigation(item.href)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
                      active
                        ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.28)]"
                        : "text-muted-foreground hover:bg-muted/65 hover:text-foreground"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className={`h-4 w-4 ${active ? "scale-105" : ""}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-border/60 px-4 py-4">
            <div className="flex items-center gap-3 rounded-xl bg-[hsl(var(--surface-2)/0.75)] px-3 py-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {user?.name?.slice(0, 1) || "S"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {user?.name || "Utilizador"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user?.email || ""}
                </div>
              </div>
            </div>
          <div className="mt-3 flex items-center gap-2">
              <ModeToggle />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "A sair..." : "Sair"}
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-40 border-b border-border/50 bg-[hsl(var(--surface-1)/0.72)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
              <div className="text-sm text-muted-foreground">
                Bem-vindo,{" "}
                <span className="font-semibold text-foreground">
                  {user?.name || "utilizador"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center rounded-full border border-border/60 bg-[hsl(var(--surface-2)/0.72)] p-1">
                  <Button
                    variant={density === "comfortable" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 rounded-full px-2 text-[11px]"
                    onClick={() => setDensity("comfortable")}
                    aria-label="Modo confortável"
                    title="Confortável"
                  >
                    <StretchHorizontal className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={density === "compact" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 rounded-full px-2 text-[11px]"
                    onClick={() => setDensity("compact")}
                    aria-label="Modo compacto"
                    title="Compacto"
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ModeToggle />
                <RequestsNotificationsBell />
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary electric-ring">
                  {user?.name?.slice(0, 2).toUpperCase() || "ST"}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  aria-label="Terminar sessão"
                  className="hidden md:inline-flex"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden" aria-label="Menu">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-t-2xl border-t border-border/70 px-4 pb-8 pt-6">
                    <DialogHeader>
                      <DialogTitle className="text-base">Navegação</DialogTitle>
                    </DialogHeader>
                    <div className="mt-2 grid gap-2">
                      {[...mobilePrimaryNav, ...mobileSecondaryNav].map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleNavigation(item.href)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                              active
                                ? "bg-primary/12 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
                      <div className="text-xs text-muted-foreground">Conta</div>
                      <div className="text-sm font-medium">{user?.name || "Utilizador"}</div>
                      <div className="text-xs text-muted-foreground">{user?.email || ""}</div>
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.75)] p-1">
                        <Button
                          variant={density === "comfortable" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 flex-1 rounded-lg text-xs"
                          onClick={() => setDensity("comfortable")}
                        >
                          Confortável
                        </Button>
                        <Button
                          variant={density === "compact" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 flex-1 rounded-lg text-xs"
                          onClick={() => setDensity("compact")}
                        >
                          Compacto
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                      >
                        {isLoggingOut ? "A sair..." : "Sair"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          <main className="content-density flex flex-1 flex-col px-4 pb-24 pt-8 sm:px-6 sm:pt-8 lg:px-10 lg:pb-10 lg:pt-10 animate-fade-up">
            {children}
          </main>
        </div>
      </div>

      {/* Force-change-password modal */}
      <Dialog open={pwOpen} onOpenChange={(o) => setPwOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar password</DialogTitle>
            <DialogDescription>É necessário alterar a sua password temporária.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <input
              type="password"
              placeholder="Nova password"
              className="input w-full rounded-md border p-2"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Confirmar password"
              className="input w-full rounded-md border p-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={changing}>
              Cancelar
            </Button>
            <Button className="ml-2" onClick={handleChangePassword} disabled={changing}>
              {changing ? "A guardar..." : "Alterar password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-[hsl(var(--surface-1)/0.92)] backdrop-blur-xl lg:hidden">
        <div
          className="grid gap-1 px-2 py-2"
          style={{ gridTemplateColumns: `repeat(${mobilePrimaryNav.length + 1}, minmax(0, 1fr))` }}
        >
          {mobilePrimaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavigation(item.href)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-muted-foreground"
              >
                <Menu className="h-4 w-4" />
                Mais
              </button>
            </DialogTrigger>
            <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-t-2xl border-t border-border/70 px-4 pb-8 pt-6">
              <DialogHeader>
              <DialogTitle className="text-base">Mais ações</DialogTitle>
              </DialogHeader>
              <div className="mt-2 grid gap-2">
                {mobileSecondaryNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNavigation(item.href)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.75)] p-1">
                <Button
                  variant={density === "comfortable" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 rounded-lg text-xs"
                  onClick={() => setDensity("comfortable")}
                >
                  Confortável
                </Button>
                <Button
                  variant={density === "compact" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 rounded-lg text-xs"
                  onClick={() => setDensity("compact")}
                >
                  Compacto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </nav>
    </div>
  );
}
