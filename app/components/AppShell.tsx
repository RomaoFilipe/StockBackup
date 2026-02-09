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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/authContext";
import { ModeToggle } from "@/app/AppHeader/ModeToggle";

interface AppShellProps {
  children: React.ReactNode;
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  active?: (pathname: string, searchParams: ReadonlyURLSearchParams | null) => boolean;
  mobile?: boolean;
};

const navItemsBase: NavItem[] = [
  {
    label: "Produtos",
    href: "/",
    icon: Package,
    mobile: true,
  },
  {
    label: "Requisições",
    href: "/requests",
    icon: LayoutGrid,
    mobile: true,
  },
  {
    label: "Storage",
    href: "/storage",
    icon: Archive,
    active: (pathname, searchParams) =>
      pathname === "/storage" && searchParams?.get("tab") !== "documents",
    mobile: true,
  },
  {
    label: "Scan",
    href: "/scan",
    icon: ScanLine,
    mobile: true,
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

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = useMemo(() => {
    const items = [...navItemsBase];
    if (user?.role === "ADMIN") {
      items.splice(3, 0, {
        label: "DB",
        href: "/DB",
        icon: Database,
        mobile: true,
      });

      items.splice(5, 0, {
        label: "Pessoas",
        href: "/users",
        icon: Users,
      });
    }
    return items;
  }, [user?.role]);

  const primaryNav = navItems.filter((item) => item.mobile);
  const secondaryNav = navItems.filter((item) => !item.mobile);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_20%_-10%,hsl(var(--primary)/0.18),transparent_45%),radial-gradient(900px_circle_at_85%_0%,hsl(var(--ring)/0.14),transparent_40%)]" />

      <div className="flex min-h-screen">
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border/60 lg:bg-card/40 lg:backdrop-blur-xl">
          <div className="flex items-center gap-3 px-6 py-6">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Stockly</div>
              <div className="text-xs text-muted-foreground">Inventory Suite</div>
            </div>
          </div>

          <nav className="flex-1 space-y-4 px-4 pb-6">
            <div className="space-y-1">
              {navItems.map((item) => {
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
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-border/60 px-4 py-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
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

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
              <div className="text-sm text-muted-foreground">
                Bem-vindo,{" "}
                <span className="font-semibold text-foreground">
                  {user?.name || "utilizador"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <ModeToggle />
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
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
                      {[...primaryNav, ...secondaryNav].map((item) => {
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

          <main className="flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-10 lg:px-10 lg:pb-10 lg:pt-12">
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {primaryNav.map((item) => {
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
                {secondaryNav.map((item) => {
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
            </DialogContent>
          </Dialog>
        </div>
      </nav>
    </div>
  );
}
