"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import {
  Boxes,
  ChevronDown,
  ClipboardList,
  FileText,
  ListTodo,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  QrCode,
  Shield,
  Truck,
  Users,
  UserCircle2,
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
import { Separator } from "@/components/ui/separator";

interface AppShellProps {
  children: React.ReactNode;
}

type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon: React.ElementType;
  roles?: Array<"ADMIN" | "USER">;
  requiredAnyPermissions?: string[];
  disabled?: boolean;
  onSelect?: () => void;
  active?: (pathname: string, searchParams: ReadonlyURLSearchParams | null) => boolean;
};

type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: Array<"ADMIN" | "USER">;
  requiredAnyPermissions?: string[];
  defaultOpen?: boolean;
  items: NavItem[];
};

type RouteAccessRule = {
  prefix: string;
  roles?: Array<"ADMIN" | "USER">;
  requiredAnyPermissions?: string[];
};

const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  { prefix: "/requests/novo", requiredAnyPermissions: ["requests.create"] },
  { prefix: "/requests/estado/novo", roles: ["USER"] },
  { prefix: "/requests/estado", roles: ["USER"] },
  { prefix: "/requests/aprovacoes", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/requests/aprovacoes-finais", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/requests", requiredAnyPermissions: ["requests.view"] },
  { prefix: "/products", requiredAnyPermissions: ["assets.manage", "assets.view"] },
  { prefix: "/units", requiredAnyPermissions: ["assets.manage", "assets.view"] },
  { prefix: "/suppliers", requiredAnyPermissions: ["assets.manage", "assets.view"] },
  { prefix: "/movements", requiredAnyPermissions: ["assets.manage", "assets.view"] },
  { prefix: "/employees", requiredAnyPermissions: ["users.manage"] },
  { prefix: "/users", requiredAnyPermissions: ["users.manage"] },
  { prefix: "/admin", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/governanca", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/business-insights", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/reports/person", requiredAnyPermissions: ["reports.view", "users.manage", "assets.view", "assets.manage"] },
  { prefix: "/reports", requiredAnyPermissions: ["reports.view", "users.manage", "assets.view", "assets.manage"] },
  { prefix: "/DB", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/api-docs", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/api-status", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/storage", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/equipamentos", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/tickets", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/portal", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/scan", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/mydesktop", requiredAnyPermissions: ["__onlylocal.disabled__"] },
  { prefix: "/", requiredAnyPermissions: ["assets.manage", "assets.view"] },
];

const navSections: NavSection[] = [
  {
    id: "requests",
    label: "Pedidos de material",
    icon: ClipboardList,
    defaultOpen: true,
    items: [
      {
        id: "my-requests",
        label: "Meus pedidos",
        href: "/requests/estado",
        icon: ListTodo,
        roles: ["USER"],
      },
      {
        id: "new-request",
        label: "Novo pedido",
        href: "/requests/estado/novo",
        icon: PlusCircle,
        roles: ["USER"],
      },
      {
        id: "requests-backoffice",
        label: "Pedidos",
        href: "/requests",
        icon: ClipboardList,
        requiredAnyPermissions: ["requests.view"],
      },
      {
        id: "create-backoffice",
        label: "Criar pedido",
        href: "/requests/novo",
        icon: PlusCircle,
        requiredAnyPermissions: ["requests.create"],
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventário de stock",
    icon: Boxes,
    requiredAnyPermissions: ["assets.manage", "assets.view"],
    items: [
      {
        id: "products",
        label: "Produtos",
        href: "/",
        icon: Package,
        requiredAnyPermissions: ["assets.manage", "assets.view"],
      },
      {
        id: "movements",
        label: "Entradas e saídas",
        href: "/movements",
        icon: Boxes,
        requiredAnyPermissions: ["assets.manage", "assets.view"],
      },
      {
        id: "unit-scanner",
        label: "Scanner QR",
        href: "/units/scan",
        icon: QrCode,
        requiredAnyPermissions: ["assets.manage", "assets.view"],
      },
      {
        id: "reservations",
        label: "Reservas QR",
        href: "/units/reservations",
        icon: QrCode,
        requiredAnyPermissions: ["assets.manage", "assets.view"],
      },
      {
        id: "person-report",
        label: "Relatório por pessoa",
        href: "/reports/person",
        icon: FileText,
        requiredAnyPermissions: ["reports.view", "users.manage", "assets.view", "assets.manage"],
      },
      {
        id: "suppliers",
        label: "Fornecedores",
        href: "/suppliers",
        icon: Truck,
        requiredAnyPermissions: ["assets.manage", "assets.view"],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin local",
    icon: Shield,
    requiredAnyPermissions: ["users.manage"],
    items: [
      {
        id: "people",
        label: "Utilizadores e acessos",
        href: "/users",
        icon: Users,
        requiredAnyPermissions: ["users.manage"],
      },
      {
        id: "employees",
        label: "Funcionários",
        href: "/employees",
        icon: Users,
        requiredAnyPermissions: ["users.manage"],
      },
    ],
  },
];

const getPersonalItems = (openProfile: () => void): NavItem[] => [
  {
    id: "profile",
    label: "Perfil",
    icon: UserCircle2,
    onSelect: openProfile,
  },
  {
    id: "my-items",
    label: "Meus pedidos",
    href: "/requests/estado",
    icon: ListTodo,
    roles: ["USER"],
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
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen ?? false])),
  );
  const lastDeniedPathRef = React.useRef<string | null>(null);

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

  const permissionSet = useMemo(() => {
    const direct = user?.permissions ?? [];
    const scoped = (user?.permissionGrants ?? []).map((grant) => grant.key);
    return new Set<string>([...direct, ...scoped]);
  }, [user?.permissionGrants, user?.permissions]);

  const canAccess = React.useCallback(
    (rules?: { roles?: Array<"ADMIN" | "USER">; requiredAnyPermissions?: string[] }) => {
      const role = user?.role;
      if (!role) return false;
      if (rules?.roles?.length && !rules.roles.includes(role)) return false;
      if (!rules?.requiredAnyPermissions?.length) return true;
      if (rules.requiredAnyPermissions.includes("__onlylocal.disabled__")) return false;
      if (permissionSet.has("*")) return true;
      return rules.requiredAnyPermissions.some((permissionKey) => permissionSet.has(permissionKey));
    },
    [permissionSet, user?.role],
  );

  const visibleSections = useMemo(() => {
    if (!user?.role) return [];
    return navSections
      .filter((section) => canAccess(section))
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canAccess(item)),
      }))
      .filter((section) => section.items.length > 0);
  }, [canAccess, user?.role]);

  const personalItems = useMemo(() => getPersonalItems(() => setPwOpen(true)), []);

  React.useEffect(() => {
    const defaults = Object.fromEntries(visibleSections.map((section) => [section.id, section.defaultOpen ?? false]));
    setSectionOpen((current) => ({ ...defaults, ...current }));
  }, [visibleSections]);

  const mobilePrimaryNav = useMemo<NavItem[]>(() => {
    const options: NavItem[] = user?.role === "USER"
      ? [
          { id: "my-requests", label: "Pedidos", href: "/requests/estado", icon: ListTodo, roles: ["USER"] },
          { id: "new", label: "Criar", href: "/requests/estado/novo", icon: PlusCircle, roles: ["USER"] },
        ]
      : [
          { id: "requests", label: "Pedidos", href: "/requests", icon: ListTodo, requiredAnyPermissions: ["requests.view"] },
          { id: "products", label: "Produtos", href: "/", icon: Package, requiredAnyPermissions: ["assets.manage", "assets.view"] },
          { id: "movements", label: "Movimentos", href: "/movements", icon: Boxes, requiredAnyPermissions: ["assets.manage", "assets.view"] },
          { id: "suppliers", label: "Fornec.", href: "/suppliers", icon: Truck, requiredAnyPermissions: ["assets.manage", "assets.view"] },
          { id: "new", label: "Criar", href: "/requests/novo", icon: PlusCircle, requiredAnyPermissions: ["requests.create"] },
        ];
    return options.filter((item) => canAccess(item));
  }, [canAccess, user?.role]);

  const mobileSecondaryNav = useMemo<NavItem[]>(() => {
    return [...visibleSections.flatMap((section) => section.items), ...personalItems].filter((item) => !item.disabled);
  }, [visibleSections, personalItems]);

  const defaultAllowedHref = useMemo(() => {
    const firstVisible = visibleSections.flatMap((section) => section.items).find((item) => item.href && !item.disabled);
    if (firstVisible?.href) return firstVisible.href;
    return "/requests/estado";
  }, [visibleSections]);

  const isCurrentPathAllowed = useMemo(() => {
    if (!pathname || !user?.role) return true;
    const matchingRule = ROUTE_ACCESS_RULES
      .slice()
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
    if (!matchingRule) return true;
    return canAccess(matchingRule);
  }, [canAccess, pathname, user?.role]);

  React.useEffect(() => {
    if (!pathname || !user?.role) return;
    if (isCurrentPathAllowed) {
      lastDeniedPathRef.current = null;
      return;
    }
    if (lastDeniedPathRef.current === pathname) return;
    lastDeniedPathRef.current = pathname;
    const target = defaultAllowedHref === pathname ? "/requests/estado" : defaultAllowedHref;
    toast({
      title: "Acesso negado",
      description: "Não tens permissão para abrir esta área.",
      variant: "destructive",
    });
    if (target !== pathname) {
      router.replace(target);
    }
  }, [defaultAllowedHref, isCurrentPathAllowed, pathname, router, toast, user?.role]);

  const isActive = (item: NavItem) => {
    if (item.active) return item.active(pathname || "", searchParams);
    if (!item.href) return false;
    if (!pathname) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const handleItemSelect = (item: NavItem) => {
    if (item.disabled) return;
    if (item.onSelect) {
      item.onSelect();
      return;
    }
    if (item.href) {
      handleNavigation(item.href);
    }
  };

  const toggleSection = (sectionId: string) => {
    setSectionOpen((current) => ({ ...current, [sectionId]: !current[sectionId] }));
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
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[200] -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Saltar para o conteúdo
      </a>
      <div className="app-mesh-bg" />

      <div className="flex min-h-screen min-w-0">
        <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-border/80 lg:bg-[hsl(var(--surface-1)/0.96)]">
          <div className="flex items-center gap-3 border-b border-border/70 px-6 py-5">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-primary/12 text-primary electric-ring">
              <Image
                src="/branding/favicon.ico"
                alt="CMCHUB Logo"
                width={44}
                height={44}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Stock Local</div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Inventário</div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col px-4 pb-6">
            <div className="space-y-3 animate-fade-up">
              {visibleSections.map((section) => {
                const SectionIcon = section.icon;
                const isOpen = sectionOpen[section.id] ?? false;
                return (
                  <section key={section.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-center gap-2">
                        <SectionIcon className="h-3.5 w-3.5" />
                        {section.label}
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen ? (
                      <div className="space-y-1 pl-1">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleItemSelect(item)}
                              disabled={item.disabled}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                                active
                                  ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.28)]"
                                  : "text-muted-foreground hover:bg-muted/65 hover:text-foreground"
                              } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground" : ""}`}
                              aria-current={active ? "page" : undefined}
                            >
                              <Icon className={`h-4 w-4 ${active ? "scale-105" : ""}`} />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
            <div className="mt-auto pt-4">
              <Separator className="mb-3 opacity-60" />
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Área Pessoal
                </div>
                {personalItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemSelect(item)}
                      disabled={item.disabled}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                        active
                          ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.28)]"
                          : "text-muted-foreground hover:bg-muted/65 hover:text-foreground"
                      } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={`h-4 w-4 ${active ? "scale-105" : ""}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-40 border-b border-border/80 bg-[hsl(var(--surface-1)/0.94)] backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
              <div className="text-sm text-muted-foreground">
                Bem-vindo,{" "}
                <span className="font-semibold text-foreground">
                  {user?.name || "utilizador"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center rounded-lg border border-border/80 bg-[hsl(var(--surface-2)/0.72)] p-1">
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
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-xs font-semibold text-primary electric-ring">
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
                      {mobileSecondaryNav.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemSelect(item)}
                            disabled={item.disabled}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                              active
                                ? "bg-primary/12 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground" : ""}`}
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

          <main id="main-content" className="content-density flex flex-1 flex-col px-4 pb-24 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10 lg:pt-8 animate-fade-up">
            {isCurrentPathAllowed ? children : null}
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
                key={item.id}
                type="button"
                onClick={() => handleItemSelect(item)}
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
                      key={item.id}
                      type="button"
                      onClick={() => handleItemSelect(item)}
                      disabled={item.disabled}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground" : ""}`}
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
