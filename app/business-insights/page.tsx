"use client";

import { AnalyticsCard } from "@/components/ui/analytics-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/ui/chart-card";
import { ForecastingCard } from "@/components/ui/forecasting-card";
import { QRCodeComponent } from "@/components/ui/qr-code";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Download,
  Eye,
  Package,
  PieChart as PieChartIcon,
  QrCode,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../authContext";
import AuthenticatedLayout from "../components/AuthenticatedLayout";
import { useProductStore } from "../useProductStore";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type OperationsInsightsDto = {
  meta: {
    generatedAt: string;
    days: number;
    from: string;
    to: string;
  };
  stock: {
    totalProducts: number;
    totalQuantity: number;
    lowStockCount: number;
    outOfStockCount: number;
    inactive90DaysCount: number;
    neverMovedCount: number;
    inactiveTop: Array<{
      productId: string;
      name: string;
      sku: string;
      lastMovedAt: string | null;
      daysSinceMove: number | null;
    }>;
  };
  requests: {
    totalRequests: number;
    pendingCount: number;
    byStatus: Array<{ status: string; count: number }>;
    signatureCompliance: {
      approvedOrFulfilledCount: number;
      approvalSignatureConsideredCount: number;
      approvedSignedCount: number;
      approvedMissingSignatureCount: number;
      pickupSignatureConsideredCount: number;
      pickupSignedCount: number;
      pickupMissingSignatureCount: number;
    };
    pendingApprovalSignature: Array<{
      id: string;
      gtmiNumber: string;
      title: string | null;
      status: string;
      requestedAt: string;
      requestingService: string | null;
    }>;
    pendingPickupSignature: Array<{
      id: string;
      gtmiNumber: string;
      title: string | null;
      status: string;
      requestedAt: string;
      requestingService: string | null;
    }>;
    topProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
  };
  movements: {
    totalMovements: number;
    byType: Array<{ type: string; count: number; quantity: number }>;
    lossesQuantity: number;
    outQuantity: number;
    topOutProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    recent: Array<{
      id: string;
      createdAt: string;
      type: string;
      quantity: number;
      productName: string;
      productSku: string;
      costCenter: string | null;
      reason: string | null;
      requestId: string | null;
      invoiceId: string | null;
    }>;
  };
  units: {
    totalUnits: number;
    byStatus: Array<{ status: string; count: number }>;
  };
};

export default function BusinessInsightsPage() {
  const { allProducts, loadProducts } = useProductStore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);
  const [origin, setOrigin] = useState("");

  const [ops, setOps] = useState<OperationsInsightsDto | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (allProducts.length > 0) return;
    loadProducts().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setOpsLoading(true);
    fetch("/api/insights/operations?days=30&top=10", { method: "GET" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error(data?.error || "Não foi possível carregar os insights.");
        }
        return r.json();
      })
      .then((data: OperationsInsightsDto) => setOps(data))
      .catch((e: any) => {
        setOps(null);
        toast({
          title: "Insights",
          description: e?.message || "Falha ao carregar indicadores operacionais.",
          variant: "destructive",
        });
      })
      .finally(() => setOpsLoading(false));
  }, [user, toast]);

  // Calculate analytics data with corrected calculations
  const analyticsData = useMemo(() => {
    if (!allProducts || allProducts.length === 0) {
      return {
        totalProducts: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalQuantity: 0,
        categoryDistribution: [],
        lowStockProducts: [],
      };
    }

    const totalProducts = allProducts.length;

    // CORRECTED: Low stock items - products with quantity > 0 AND quantity <= 20 (matching product table logic)
    const lowStockItems = allProducts.filter(
      (product) =>
        Number(product.quantity) > 0 && Number(product.quantity) <= 20
    ).length;

    // CORRECTED: Out of stock items - products with quantity = 0
    const outOfStockItems = allProducts.filter(
      (product) => Number(product.quantity) === 0
    ).length;

    // CORRECTED: Total quantity - sum of all quantities
    const totalQuantity = allProducts.reduce((sum, product) => {
      return sum + Number(product.quantity);
    }, 0);

    // Category distribution based on quantity (not just count)
    const categoryMap = new Map<
      string,
      { count: number; quantity: number; value: number }
    >();
    allProducts.forEach((product) => {
      const category = product.category || "Desconhecida";
      const current = categoryMap.get(category) || {
        count: 0,
        quantity: 0,
        value: 0,
      };
      categoryMap.set(category, {
        count: current.count + 1,
        quantity: current.quantity + Number(product.quantity),
        value: current.value,
      });
    });

    // Convert to percentage based on quantity
    const categoryDistribution = Array.from(categoryMap.entries()).map(
      ([name, data]) => ({
        name,
        value: data.quantity,
        count: data.count,
        totalValue: data.value,
      })
    );

    // Low stock products (matching product table logic: quantity > 0 AND quantity <= 20)
    const lowStockProducts = allProducts
      .filter(
        (product) =>
          Number(product.quantity) > 0 && Number(product.quantity) <= 20
      )
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .slice(0, 5);

    return {
      totalProducts,
      lowStockItems,
      outOfStockItems,
      totalQuantity,
      categoryDistribution,
      lowStockProducts,
    };
  }, [allProducts]);

  const handleExportAnalytics = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/reports/business-insights/pdf", { method: "GET" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Não foi possível exportar.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `insights-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      toast({ title: "Exportado" });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível exportar.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (!user) {
    return (
      <AuthenticatedLayout>
        <EmptyState
          title="Sessão necessária"
          description="Inicia sessão para ver os insights do inventário."
        />
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="Insights"
          description="Indicadores operacionais para controlo: stock, requisições, movimentos e alertas."
          actions={
            <Button
              onClick={handleExportAnalytics}
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              {exporting ? "A exportar..." : "Exportar"}
            </Button>
          }
        />

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <AnalyticsCard
            title="Stock baixo"
            value={analyticsData.lowStockItems}
            icon={AlertTriangle}
            iconColor="text-chart-4"
            description="Quantidade > 0 e ≤ 20"
            className="rounded-2xl border-border/60 bg-card/60"
          />
          <AnalyticsCard
            title="Sem stock"
            value={analyticsData.outOfStockItems}
            icon={ShoppingCart}
            iconColor="text-destructive"
            description="Quantidade igual a zero"
            className="rounded-2xl border-border/60 bg-card/60"
          />
          <AnalyticsCard
            title="Requisições a tratar"
            value={ops?.requests.pendingCount ?? 0}
            icon={Users}
            iconColor="text-chart-1"
            description={opsLoading ? "A carregar…" : "Últimos 30 dias (SUBMITTED/APPROVED)"}
            className="rounded-2xl border-border/60 bg-card/60"
          />
          <AnalyticsCard
            title="Perdas / Sucata"
            value={ops?.movements.lossesQuantity ?? 0}
            icon={Activity}
            iconColor="text-destructive"
            description={opsLoading ? "A carregar…" : "Últimos 30 dias (LOST + SCRAP)"}
            className="rounded-2xl border-border/60 bg-card/60"
          />
        </div>

        {/* Charts and Insights */}
        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList className="grid h-11 w-full grid-cols-4 rounded-2xl bg-[hsl(var(--surface-2)/0.8)] p-1.5">
            <TabsTrigger value="inventory">Inventário</TabsTrigger>
            <TabsTrigger value="requests">Requisições</TabsTrigger>
            <TabsTrigger value="movements">Movimentos</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-in">
              {/* Category Distribution */}
              <ChartCard
                title="Distribuição por categoria"
                icon={PieChartIcon}
                className="rounded-2xl border-border/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.categoryDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="hsl(var(--chart-1))"
                      dataKey="value"
                    >
                      {analyticsData.categoryDistribution.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Units status */}
              <ChartCard
                title="Unidades por estado"
                icon={Activity}
                className="rounded-2xl border-border/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(ops?.units.byStatus ?? []).map((r) => ({ name: r.status, value: r.count }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-in">
              {/* Requests by status */}
              <ChartCard
                title="Requisições por estado (30 dias)"
                icon={Activity}
                className="rounded-2xl border-border/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(ops?.requests.byStatus ?? []).map((r) => ({ name: r.status, value: r.count }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Top requested products */}
              <ChartCard
                title="Top produtos requisitados (30 dias)"
                icon={Users}
                className="rounded-2xl border-border/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(ops?.requests.topProducts ?? []).map((r) => ({ name: r.name, value: r.quantity }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-3))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-in">
              <ChartCard
                title="Pendentes de assinatura (aprovação)"
                icon={Users}
                className="rounded-2xl border-border/60"
              >
                <div className="space-y-3">
                  {(ops?.requests.pendingApprovalSignature ?? []).length ? (
                    (ops?.requests.pendingApprovalSignature ?? []).slice(0, 10).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {r.gtmiNumber}{r.title ? ` — ${r.title}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.requestingService ? r.requestingService : "Sem serviço"}
                          </div>
                        </div>

                        <Button asChild variant="outline" className="h-8 rounded-xl">
                          <Link href={`/requests/${r.id}`}>Abrir</Link>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        {opsLoading ? "A carregar…" : "Sem pendentes de aprovação."}
                      </p>
                    </div>
                  )}
                </div>
              </ChartCard>

              <ChartCard
                title="Pendentes de assinatura (levantamento)"
                icon={Package}
                className="rounded-2xl border-border/60"
              >
                <div className="space-y-3">
                  {(ops?.requests.pendingPickupSignature ?? []).length ? (
                    (ops?.requests.pendingPickupSignature ?? []).slice(0, 10).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {r.gtmiNumber}{r.title ? ` — ${r.title}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.requestingService ? r.requestingService : "Sem serviço"}
                          </div>
                        </div>

                        <Button asChild variant="outline" className="h-8 rounded-xl">
                          <Link href={`/requests/${r.id}`}>Abrir</Link>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        {opsLoading ? "A carregar…" : "Sem pendentes de levantamento."}
                      </p>
                    </div>
                  )}
                </div>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Movements by type */}
              <ChartCard
                title="Movimentos por tipo (30 dias)"
                icon={Activity}
                className="rounded-2xl border-border/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(ops?.movements.byType ?? []).map((r) => ({ name: r.type, value: r.count }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-4))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Top OUT products */}
              <ChartCard
                title="Top consumo (OUT) (30 dias)"
                icon={Package}
                className="rounded-2xl border-border/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(ops?.movements.topOutProducts ?? []).map((r) => ({ name: r.name, value: r.quantity }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-5))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {/* Low Stock Alerts */}
            <ChartCard
              title="Alertas de stock baixo"
              icon={AlertTriangle}
              className="rounded-2xl border-border/60"
            >
              <div className="space-y-4">
                {analyticsData.lowStockProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyticsData.lowStockProducts.map((product, index) => (
                      <Card
                        key={index}
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-sm">
                                {product.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                SKU: {product.sku}
                              </p>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {product.quantity} restante
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Sem alertas de stock baixo neste momento.
                    </p>
                  </div>
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="Produtos inativos (≥ 90 dias sem movimentos)"
              icon={Eye}
              className="rounded-2xl border-border/60"
            >
              <div className="space-y-4">
                {ops?.stock.inactiveTop?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ops.stock.inactiveTop.slice(0, 6).map((p) => (
                      <Card key={p.productId} className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.78)]">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{p.name}</div>
                              <div className="text-xs text-muted-foreground truncate">SKU: {p.sku}</div>
                            </div>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {p.daysSinceMove == null ? "Sem histórico" : `${p.daysSinceMove}d`}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      {opsLoading ? "A carregar…" : "Sem produtos inativos para destacar."}
                    </p>
                  </div>
                )}
              </div>
            </ChartCard>
          </TabsContent>
        </Tabs>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger-in">
          <Card className="glass-panel rounded-2xl border border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Resumo rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total de produtos</span>
                <span className="font-semibold">{analyticsData.totalProducts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Quantidade total</span>
                <span className="font-semibold">
                  {(ops?.stock.totalQuantity ?? analyticsData.totalQuantity).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Inativos (≥ 90 dias)</span>
                <span className="font-semibold">{ops?.stock.inactive90DaysCount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Nunca movidos</span>
                <span className="font-semibold">{ops?.stock.neverMovedCount ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel rounded-2xl border border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Conformidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Assinatura (aprovação)</span>
                <span className="font-semibold">
                  {ops?.requests.signatureCompliance.approvedSignedCount ?? 0}/
                  {ops?.requests.signatureCompliance.approvalSignatureConsideredCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Assinatura (levantamento)</span>
                <span className="font-semibold">
                  {ops?.requests.signatureCompliance.pickupSignedCount ?? 0}/
                  {ops?.requests.signatureCompliance.pickupSignatureConsideredCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Pendentes de assinatura</span>
                <Badge variant={(ops?.requests.signatureCompliance.approvedMissingSignatureCount ?? 0) > 0 ? "destructive" : "default"}>
                  {opsLoading
                    ? "A carregar…"
                    : `${ops?.requests.signatureCompliance.approvedMissingSignatureCount ?? 0} aprovação / ${ops?.requests.signatureCompliance.pickupMissingSignatureCount ?? 0} levantamento`}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel rounded-2xl border border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR rápido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QRCodeComponent
                data={`${origin || ""}/business-insights`}
                title="QR do dashboard"
                size={120}
                showDownload={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Forecasting Section */}
        <ForecastingCard products={allProducts} />
      </div>
    </AuthenticatedLayout>
  );
}
