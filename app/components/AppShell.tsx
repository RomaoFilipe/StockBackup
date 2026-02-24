"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardList,
  Database,
  ListTodo,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  Shield,
  KeyRound,
  Ticket,
  Users,
  UserCircle2,
  UserRoundCheck,
  Rows3,
  StretchHorizontal,
  MessageCircle,
  HandCoins,
  FileCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/app/authContext";
import { ModeToggle } from "@/app/AppHeader/ModeToggle";
import { RequestsNotificationsBell } from "@/app/AppHeader/RequestsNotificationsBell";
import PresenceWidget from "@/app/components/PresenceWidget";
import TicketMessageNotifier from "@/app/components/TicketMessageNotifier";
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
  disabled?: boolean;
  onSelect?: () => void;
  active?: (pathname: string, searchParams: ReadonlyURLSearchParams | null) => boolean;
};

type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: Array<"ADMIN" | "USER">;
  defaultOpen?: boolean;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    id: "work",
    label: "Trabalho",
    icon: BriefcaseBusiness,
    defaultOpen: true,
    items: [
      {
        id: "backlog",
        label: "Backlog",
        href: "/requests/estado",
        icon: ListTodo,
      },
      {
        id: "requests",
        label: "Requisições",
        href: "/requests",
        icon: ClipboardList,
        roles: ["ADMIN"],
      },
      {
        id: "tickets",
        label: "Tickets",
        href: "/tickets",
        icon: Ticket,
      },
      {
        id: "my-items",
        label: "Meus Itens",
        href: "/requests/estado",
        icon: UserRoundCheck,
      },
      {
        id: "mydesktop",
        label: "Recebidos",
        href: "/mydesktop",
        icon: StretchHorizontal,
        roles: ["USER"],
      },
      {
        id: "new",
        label: "Criar Novo",
        href: "/requests/novo",
        icon: PlusCircle,
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventário & Ativos",
    icon: Boxes,
    roles: ["ADMIN"],
    items: [
      {
        id: "products",
        label: "Produtos",
        href: "/",
        icon: Package,
      },
      {
        id: "equipment",
        label: "Equipamentos",
        href: "/equipamentos",
        icon: Boxes,
      },
      {
        id: "storage",
        label: "Armazém",
        href: "/storage",
        icon: Archive,
        active: (pathname, currentSearchParams) =>
          pathname === "/storage" && currentSearchParams?.get("tab") !== "documents",
      },
    ],
  },
  {
    id: "municipal-governance",
    label: "Governança Municipal",
    icon: Building2,
    defaultOpen: true,
    items: [
      {
        id: "governance",
        label: "Visão Geral",
        href: "/governanca",
        icon: Building2,
      },
      {
        id: "assets",
        label: "Património",
        href: "/governanca/patrimonio",
        icon: Archive,
      },
      {
        id: "finance",
        label: "Financiamento",
        href: "/governanca/financiamento",
        icon: HandCoins,
      },
      {
        id: "external-internal-requests",
        label: "Requerimentos",
        href: "/governanca/requerimentos",
        icon: FileCheck,
      },
      {
        id: "rbac",
        label: "Permissões",
        href: "/governanca/permissoes",
        icon: KeyRound,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    id: "people",
    label: "Pessoas & Análise",
    icon: Users,
    items: [
      {
        id: "people",
        label: "Pessoas",
        href: "/users",
        icon: Users,
        roles: ["ADMIN"],
      },
      {
        id: "insights",
        label: "Insights",
        href: "/business-insights",
        icon: BarChart3,
      },
      {
        id: "reports",
        label: "Relatórios",
        href: "/reports/ticket-operations",
        icon: Rows3,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    icon: Shield,
    roles: ["ADMIN"],
    items: [
      {
        id: "database",
        label: "Base de Dados",
        href: "/DB",
        icon: Database,
      },
      {
        id: "api-docs",
        label: "Documentação da API",
        href: "/api-docs",
        icon: BookOpen,
      },
      {
        id: "api-status",
        label: "Estado da API",
        href: "/api-status",
        icon: Activity,
      },
      {
        id: "logs",
        label: "Logs (em breve)",
        icon: Archive,
        disabled: true,
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
    label: "Meus Itens",
    href: "/requests/estado",
    icon: UserRoundCheck,
  },
  {
    id: "presence",
    label: "Estado Pessoal (em breve)",
    icon: Activity,
    disabled: true,
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
  const [userTicketCreateOpen, setUserTicketCreateOpen] = useState(false);
  const [creatingUserTicket, setCreatingUserTicket] = useState(false);
  const [userTicketTitle, setUserTicketTitle] = useState("");
  const [userTicketDescription, setUserTicketDescription] = useState("");
  const [userTicketPriority, setUserTicketPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "CRITICAL">("NORMAL");
  const [userTicketType, setUserTicketType] = useState<"INCIDENT" | "REQUEST" | "QUESTION" | "CHANGE">("QUESTION");
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen ?? false])),
  );

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

  const visibleSections = useMemo(() => {
    const role = user?.role;
    if (!role) return [];
    return navSections
      .filter((section) => !section.roles || section.roles.includes(role))
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
      }))
      .filter((section) => section.items.length > 0);
  }, [user?.role]);

  const personalItems = useMemo(() => getPersonalItems(() => setPwOpen(true)), []);

  React.useEffect(() => {
    const defaults = Object.fromEntries(visibleSections.map((section) => [section.id, section.defaultOpen ?? false]));
    setSectionOpen((current) => ({ ...defaults, ...current }));
  }, [visibleSections]);

  const mobilePrimaryNav = useMemo<NavItem[]>(() => {
    if (user?.role === "USER") {
      return [
        { id: "backlog", label: "Backlog", href: "/requests/estado", icon: ListTodo },
        { id: "mydesktop", label: "Recebidos", href: "/mydesktop", icon: StretchHorizontal },
        { id: "tickets", label: "Tickets", href: "/tickets", icon: MessageCircle },
        { id: "new", label: "Criar", href: "/requests/novo", icon: PlusCircle },
      ];
    }

    return [
      { id: "backlog", label: "Backlog", href: "/requests", icon: ListTodo },
      { id: "tickets", label: "Tickets", href: "/tickets", icon: MessageCircle },
      { id: "products", label: "Produtos", href: "/", icon: Package },
      { id: "new", label: "Criar", href: "/requests/novo", icon: PlusCircle },
    ];
  }, [user?.role]);

  const mobileSecondaryNav = useMemo<NavItem[]>(() => {
    return [...visibleSections.flatMap((section) => section.items), ...personalItems].filter((item) => !item.disabled);
  }, [visibleSections, personalItems]);

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

  const handleCreateUserTicket = async () => {
    if (!userTicketTitle.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Preenche o título do ticket.",
        variant: "destructive",
      });
      return;
    }

    setCreatingUserTicket(true);
    try {
      const res = await axiosInstance.post("/tickets", {
        title: userTicketTitle.trim(),
        description: userTicketDescription.trim() || undefined,
        priority: userTicketPriority,
        type: userTicketType,
      });

      const ticketId = res?.data?.id as string | undefined;
      setUserTicketCreateOpen(false);
      setUserTicketTitle("");
      setUserTicketDescription("");
      setUserTicketPriority("NORMAL");
      setUserTicketType("QUESTION");

      if (ticketId) {
        router.push(`/tickets/${ticketId}`);
        return;
      }

      toast({ title: "Ticket criado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar ticket.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingUserTicket(false);
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
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-primary/16 text-primary electric-ring">
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
              <div className="text-lg font-semibold tracking-tight">CMCHUB</div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Inventory Suite</div>
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
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
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
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
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

      {user?.role === "USER" ? (
        <button
          type="button"
          onClick={() => setUserTicketCreateOpen(true)}
          className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-1 ring-primary/35 transition hover:scale-[1.03] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 lg:bottom-24 lg:right-6"
          aria-label="Criar ticket"
          title="Criar ticket"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : null}

      <PresenceWidget />
      <TicketMessageNotifier />

      <Dialog open={userTicketCreateOpen} onOpenChange={setUserTicketCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Ticket</DialogTitle>
            <DialogDescription>Abre um ticket para suporte técnico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={userTicketTitle}
              onChange={(e) => setUserTicketTitle(e.target.value)}
              placeholder="Título do problema"
            />
            <Textarea
              value={userTicketDescription}
              onChange={(e) => setUserTicketDescription(e.target.value)}
              placeholder="Descreve o problema"
              rows={4}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={userTicketPriority}
                onChange={(e) => setUserTicketPriority(e.target.value as typeof userTicketPriority)}
              >
                <option value="LOW">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={userTicketType}
                onChange={(e) => setUserTicketType(e.target.value as typeof userTicketType)}
              >
                <option value="QUESTION">Dúvida</option>
                <option value="INCIDENT">Incidente</option>
                <option value="REQUEST">Pedido</option>
                <option value="CHANGE">Mudança</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserTicketCreateOpen(false)} disabled={creatingUserTicket}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateUserTicket()} disabled={creatingUserTicket || !userTicketTitle.trim()}>
              {creatingUserTicket ? "A criar..." : "Criar ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
