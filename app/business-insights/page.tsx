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
import {
  Activity,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Download,
  Eye,
  Package,
  PieChart as PieChartIcon,
  QrCode,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

export default function BusinessInsightsPage() {
  const { allProducts } = useProductStore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }),
    []
  );

  // Calculate analytics data with corrected calculations
  const analyticsData = useMemo(() => {
    if (!allProducts || allProducts.length === 0) {
      return {
        totalProducts: 0,
        totalValue: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        averagePrice: 0,
        totalQuantity: 0,
        categoryDistribution: [],
        statusDistribution: [],
        priceRangeDistribution: [],
        monthlyTrend: [],
        topProducts: [],
        lowStockProducts: [],
        stockUtilization: 0,
        valueDensity: 0,
        stockCoverage: 0,
      };
    }

    const totalProducts = allProducts.length;

    // CORRECTED: Total value calculation - sum of (price * quantity) for each product
    const totalValue = allProducts.reduce((sum, product) => {
      return sum + product.price * Number(product.quantity);
    }, 0);

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

    // CORRECTED: Average price calculation - total value divided by total quantity
    const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    // CORRECTED: Stock utilization - percentage of products that are not out of stock
    const stockUtilization =
      totalProducts > 0
        ? ((totalProducts - outOfStockItems) / totalProducts) * 100
        : 0;

    // CORRECTED: Value density - total value divided by total products
    const valueDensity = totalProducts > 0 ? totalValue / totalProducts : 0;

    // CORRECTED: Stock coverage - average quantity per product
    const stockCoverage = totalProducts > 0 ? totalQuantity / totalProducts : 0;

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
        value: current.value + product.price * Number(product.quantity),
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

    // Status distribution
    const statusMap = new Map<string, number>();
    allProducts.forEach((product) => {
      const status = product.status || "Desconhecido";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const statusDistribution = Array.from(statusMap.entries()).map(
      ([name, value]) => ({ name, value })
    );

    // Price range distribution
    const priceRanges: Array<{
      label: string;
      min: number;
      max: number;
      maxInclusive?: boolean;
    }> = [
      { label: "0–100 €", min: 0, max: 100 },
      { label: "100–500 €", min: 100, max: 500 },
      { label: "500–1 000 €", min: 500, max: 1000 },
      {
        label: "1 000–2 000 €",
        min: 1000,
        max: 2000,
        maxInclusive: true,
      },
      { label: "2 000+ €", min: 2000, max: Infinity },
    ];

    const priceRangeDistribution = priceRanges.map((range) => ({
      name: range.label,
      value: allProducts.filter((product) => {
        if (range.max === Infinity) {
          return product.price > range.min;
        }
        if (range.maxInclusive) {
          return product.price >= range.min && product.price <= range.max;
        }
        return product.price >= range.min && product.price < range.max;
      }).length,
    }));

    // CORRECTED: Monthly trend based on actual product creation dates
    const monthlyTrend: Array<{
      month: string;
      products: number;
      monthlyAdded: number;
    }> = [];
    const monthFormatter = new Intl.DateTimeFormat("pt-PT", { month: "short" });
    const months = Array.from({ length: 12 }, (_, index) => {
      const raw = monthFormatter.format(new Date(Date.UTC(2020, index, 1)));
      const normalized = raw.endsWith(".") ? raw.slice(0, -1) : raw;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    });

    // Group products by creation month using UTC to avoid timezone issues
    const productsByMonth = new Map<string, number>();
    allProducts.forEach((product) => {
      const date = new Date(product.createdAt);
      // Use UTC methods to ensure consistent month extraction
      const monthKey = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
      ).padStart(2, "0")}`;
      productsByMonth.set(monthKey, (productsByMonth.get(monthKey) || 0) + 1);
    });

    // Create trend data for the whole year
    // Use the year from the first product's creation date to ensure correct year mapping
    const dataYear =
      allProducts.length > 0
        ? new Date(allProducts[0].createdAt).getUTCFullYear()
        : new Date().getUTCFullYear();
    let cumulativeProducts = 0;

    months.forEach((month, index) => {
      const monthKey = `${dataYear}-${String(index + 1).padStart(2, "0")}`;
      const productsThisMonth = productsByMonth.get(monthKey) || 0;
      cumulativeProducts += productsThisMonth;

      monthlyTrend.push({
        month,
        products: cumulativeProducts,
        monthlyAdded: productsThisMonth,
      });
    });

    // Top products by value
    const topProducts = allProducts
      .sort(
        (a, b) => b.price * Number(b.quantity) - a.price * Number(a.quantity)
      )
      .slice(0, 5)
      .map((product) => ({
        name: product.name,
        value: product.price * Number(product.quantity),
        quantity: Number(product.quantity),
      }));

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
      totalValue,
      lowStockItems,
      outOfStockItems,
      averagePrice,
      totalQuantity,
      stockUtilization,
      valueDensity,
      stockCoverage,
      categoryDistribution,
      statusDistribution,
      priceRangeDistribution,
      monthlyTrend,
      topProducts,
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
          description="Indicadores e gráficos para acompanhar o inventário."
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total de produtos"
            value={analyticsData.totalProducts}
            icon={Package}
            iconColor="text-chart-1"
            description="Produtos no inventário"
            className="rounded-2xl border-border/60 bg-card/60"
          />
          <AnalyticsCard
            title="Valor total"
            value={currencyFormatter.format(analyticsData.totalValue)}
            icon={DollarSign}
            iconColor="text-chart-2"
            description="Valor total do inventário"
            className="rounded-2xl border-border/60 bg-card/60"
          />
          <AnalyticsCard
            title="Stock baixo"
            value={analyticsData.lowStockItems}
            icon={AlertTriangle}
            iconColor="text-chart-4"
            description="Itens com quantidade ≤ 20"
            className="rounded-2xl border-border/60 bg-card/60"
          />
          <AnalyticsCard
            title="Sem stock"
            value={analyticsData.outOfStockItems}
            icon={ShoppingCart}
            iconColor="text-destructive"
            description="Itens com quantidade zero"
            className="rounded-2xl border-border/60 bg-card/60"
          />
        </div>

        {/* Charts and Insights */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid h-11 w-full grid-cols-4 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="distribution">Distribuição</TabsTrigger>
            <TabsTrigger value="trends">Tendências</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Category Distribution */}
              <ChartCard
                title="Distribuição por categoria"
                icon={PieChartIcon}
                className="rounded-2xl border-border/60 bg-card/60"
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

              {/* Monthly Trend - Full Year */}
              <ChartCard
                title="Crescimento de produtos (ano)"
                icon={TrendingUp}
                className="rounded-2xl border-border/60 bg-card/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.monthlyTrend}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
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
                    <Area
                      type="monotone"
                      dataKey="products"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status Distribution */}
              <ChartCard
                title="Distribuição por estado"
                icon={Activity}
                className="rounded-2xl border-border/60 bg-card/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.statusDistribution}>
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

              {/* Price Range Distribution */}
              <ChartCard
                title="Distribuição por intervalo de preço"
                icon={BarChart3}
                className="rounded-2xl border-border/60 bg-card/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.priceRangeDistribution}>
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
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Products by Value */}
              <ChartCard
                title="Top produtos por valor"
                icon={TrendingUp}
                className="rounded-2xl border-border/60 bg-card/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analyticsData.topProducts}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [
                        currencyFormatter.format(Number(value)),
                        "Valor",
                      ]}
                      labelFormatter={(label) => `Produto: ${label}`}
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

              {/* Monthly Product Addition Trend */}
              <ChartCard
                title="Entradas mensais"
                icon={TrendingDown}
                className="rounded-2xl border-border/60 bg-card/60"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.monthlyTrend}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
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
                    <Line
                      type="monotone"
                      dataKey="monthlyAdded"
                      stroke="hsl(var(--chart-5))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {/* Low Stock Alerts */}
            <ChartCard
              title="Alertas de stock baixo"
              icon={AlertTriangle}
              className="rounded-2xl border-border/60 bg-card/60"
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
          </TabsContent>
        </Tabs>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rounded-2xl border border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Resumo rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Preço médio</span>
                <span className="font-semibold">
                  {currencyFormatter.format(analyticsData.averagePrice)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Quantidade total</span>
                <span className="font-semibold">
                  {analyticsData.totalQuantity.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Utilização de stock</span>
                <span className="font-semibold">
                  {analyticsData.stockUtilization.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Desempenho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Saúde do inventário</span>
                <Badge
                  variant={
                    analyticsData.lowStockItems > 5 ? "destructive" : "default"
                  }
                >
                  {analyticsData.lowStockItems > 5
                    ? "Precisa de atenção"
                    : "Saudável"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cobertura de stock</span>
                <span className="font-semibold">
                  {analyticsData.stockCoverage.toFixed(1)} unid. (média)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Densidade de valor</span>
                <span className="font-semibold">
                  {currencyFormatter.format(analyticsData.valueDensity)} por produto
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-card/60">
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
