"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AiFillProduct } from "react-icons/ai";
import { FiActivity, FiBarChart, FiFileText, FiHome } from "react-icons/fi"; // Import icons for new nav items
import { useAuth } from "../authContext";
import { ModeToggle } from "./ModeToggle";

export default function AppHeader() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      }, 1500);
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

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const isActive = (path: string) => pathname === path || pathname?.startsWith(`${path}/`);

  const storageTab = searchParams?.get("tab");

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="rounded-t-lg border-b bg-card text-card-foreground">
      <div className="p-4 sm:p-6 flex flex-col gap-4">
        {/* Top row: brand + user */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleNavigation("/")}
              className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
              aria-label="Ir para Produtos"
            >
              <AiFillProduct className="text-2xl" />
            </button>
            <div>
              <div className="text-lg font-semibold leading-tight">Stockly</div>
              <div className="text-xs text-muted-foreground">
                {user?.name ? `Bem-vindo, ${user.name}` : "Bem-vindo"}
                {user?.email ? ` • ${user.email}` : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="outline"
            >
              {isLoggingOut ? "A sair..." : "Sair"}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isActive("/") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/")}
            >
              <FiHome className="mr-2 h-4 w-4" />
              Produtos
            </Button>

            <Button
              variant={isActive("/requests") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/requests")}
            >
              <FiFileText className="mr-2 h-4 w-4" />
              Requisições
            </Button>

            <Button
              variant={isActive("/movements") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/movements")}
            >
              <FiActivity className="mr-2 h-4 w-4" />
              Movimentos
            </Button>

            <Button
              variant={isActive("/storage") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/storage")}
            >
              <FiFileText className="mr-2 h-4 w-4" />
              Storage
            </Button>

            <Button
              variant={isActive("/storage") && storageTab === "documents" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/storage?tab=documents")}
            >
              <FiFileText className="mr-2 h-4 w-4" />
              Documentos
            </Button>

            {isAdmin ? (
              <Button
                variant={isActive("/users") ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleNavigation("/users")}
              >
                <FiFileText className="mr-2 h-4 w-4" />
                Pessoas
              </Button>
            ) : null}
          </div>

          {/* Secondary links */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isActive("/business-insights") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/business-insights")}
            >
              <FiBarChart className="mr-2 h-4 w-4" />
              Insights
            </Button>

            <Button
              variant={isActive("/api-docs") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/api-docs")}
            >
              <FiFileText className="mr-2 h-4 w-4" />
              Documentação API
            </Button>

            <Button
              variant={isActive("/api-status") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleNavigation("/api-status")}
            >
              <FiActivity className="mr-2 h-4 w-4" />
              Estado da API
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
