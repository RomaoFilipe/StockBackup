import type { BusinessInsightsReportData } from "@/utils/businessInsightsReport";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-PT");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-PT");
}

function pct(n: number) {
  return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"}%`;
}

function barChartSvg(rows: Array<{ name: string; value: number }>, width = 760, height = 220) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barW = Math.max(16, Math.floor((width - 80) / Math.max(1, rows.length)) - 8);
  const baseY = height - 40;
  const bars = rows
    .slice(0, 12)
    .map((r, idx) => {
      const h = Math.max(2, Math.round(((r.value || 0) / max) * (height - 80)));
      const x = 40 + idx * (barW + 8);
      const y = baseY - h;
      const label = r.name.length > 10 ? `${r.name.slice(0, 10)}…` : r.name;
      return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#1f6feb" rx="4" />
      <text x="${x + barW / 2}" y="${baseY + 14}" text-anchor="middle" font-size="10" fill="#4b5563">${esc(label)}</text>
      <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#111827">${r.value}</text>
    `;
    })
    .join("\n");

  return `
  <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="chart">
    <line x1="30" y1="${baseY}" x2="${width - 20}" y2="${baseY}" stroke="#d1d5db" stroke-width="1" />
    ${bars}
  </svg>`;
}

function renderSimpleTable(headers: string[], rows: string[][]) {
  return `
  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("\n")}
    </tbody>
  </table>`;
}

export function renderBusinessInsightsReportHtml(report: BusinessInsightsReportData) {
  const categoryChart = barChartSvg(report.inventory.categoryDistribution.map((r) => ({ name: r.name, value: r.value })));
  const requestStatusChart = barChartSvg(report.requests.byStatus.map((r) => ({ name: r.status, value: r.count })));
  const movementTypeChart = barChartSvg(report.movements.byType.map((r) => ({ name: r.type, value: r.count })));

  const headerPeriod = `${fmtDate(report.meta.period.from.toISOString())} - ${fmtDate(report.meta.period.to.toISOString())}`;

  const topConsumptionRows = report.annex.top20Consumption.map((r, idx) => [
    String(idx + 1),
    r.name,
    r.sku,
    String(r.quantity),
  ]);

  const pendingRows = report.annex.pendingRequests.map((r) => [
    r.gtmiNumber,
    r.title || "—",
    r.status,
    fmtDateTime(r.requestedAt),
    r.requestingService || "—",
  ]);

  const alertRows = report.risk.allAlerts.map((a, idx) => [String(idx + 1), a]);

  const pendingSigRows = report.requests.pendingSignatures.map((r) => [
    r.gtmiNumber,
    r.title || "—",
    r.missing,
    fmtDateTime(r.requestedAt),
  ]);

  const inventoryInactiveRows = report.inventory.inactive90Days.slice(0, 20).map((r) => [
    r.name,
    r.sku,
    r.daysSinceMove == null ? "Nunca" : String(r.daysSinceMove),
  ]);

  const replenishRows = report.inventory.suggestedReplenishment.slice(0, 20).map((r) => [
    r.name,
    r.sku,
    String(r.currentQty),
    String(r.suggestedQty),
  ]);

  return `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Stockly Business Insights Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111827; }
    .page { width: 100%; max-width: 980px; margin: 0 auto; padding: 28px 28px 48px; }
    .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 14px; margin-bottom: 18px; }
    .brand { font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
    .subhead { margin-top: 8px; color: #374151; font-size: 12px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px; }
    .section { margin-top: 22px; page-break-inside: avoid; }
    .section h2 { font-size: 17px; margin: 0 0 10px; border-left: 4px solid #1f6feb; padding-left: 8px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
    .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
    .kpi .label { font-size: 11px; color: #4b5563; }
    .kpi .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .muted { color: #6b7280; font-size: 12px; }
    .narrative { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-top: 10px; }
    .narrative li { margin: 4px 0; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 700; }
    .pill { display: inline-block; font-size: 11px; border: 1px solid #d1d5db; border-radius: 999px; padding: 2px 8px; margin-right: 6px; }
    .footer-hash { margin-top: 16px; font-size: 11px; color: #6b7280; text-align: right; }
    .avoid-break { page-break-inside: avoid; }
    @media print {
      .page { padding: 18px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="brand">Stockly</div>
      <div class="subhead">
        <div><strong>Tenant:</strong> ${esc(report.meta.tenantName)}</div>
        <div><strong>Período:</strong> ${esc(headerPeriod)}</div>
        <div><strong>Gerado em:</strong> ${esc(fmtDateTime(report.meta.generatedAt))}</div>
        <div><strong>Gerado por:</strong> ${esc(report.meta.generatedBy.name)} (${esc(report.meta.generatedBy.email)})</div>
      </div>
    </header>

    <section class="section">
      <h2>1. Executive Summary</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="label">Stock baixo</div><div class="value">${report.executive.stockLow}</div></div>
        <div class="kpi"><div class="label">Sem stock</div><div class="value">${report.executive.outOfStock}</div></div>
        <div class="kpi"><div class="label">Requisições a tratar</div><div class="value">${report.executive.pendingRequests}</div></div>
        <div class="kpi"><div class="label">Perdas / Sucata</div><div class="value">${report.executive.lossesScrap}</div></div>
        <div class="kpi"><div class="label">SLA compliance</div><div class="value">${pct(report.executive.slaCompliancePct)}</div></div>
        <div class="kpi"><div class="label">Warehouse Health Score</div><div class="value">${report.executive.warehouseHealthScore}</div></div>
      </div>
    </section>

    <section class="section">
      <h2>2. Inventory Analysis</h2>
      <div class="avoid-break">${categoryChart}</div>
      <div class="split">
        <div>${renderSimpleTable(["Produto", "SKU", "Dias sem movimento"], inventoryInactiveRows.length ? inventoryInactiveRows : [["—","—","—"]])}</div>
        <div>${renderSimpleTable(["Produto", "SKU", "Qtd atual", "Qtd sugerida"], replenishRows.length ? replenishRows : [["—","—","—","—"]])}</div>
      </div>
      <p class="muted">Produtos nunca movidos: ${report.inventory.neverMoved.length}</p>
    </section>

    <section class="section">
      <h2>3. Requests Analysis</h2>
      <div class="avoid-break">${requestStatusChart}</div>
      <div class="split">
        <div>${renderSimpleTable(["Top Produto", "SKU", "Qtd"], report.requests.topRequestedProducts.slice(0, 12).map((r) => [r.name, r.sku, String(r.quantity)]))}</div>
        <div>${renderSimpleTable(["GTMI", "Título", "Assinatura em falta", "Data"], pendingSigRows.length ? pendingSigRows : [["—","—","—","—"]])}</div>
      </div>
    </section>

    <section class="section">
      <h2>4. Movements Analysis</h2>
      <div class="avoid-break">${movementTypeChart}</div>
      <div class="split">
        <div>
          <p class="muted">OUT atual: <strong>${report.movements.trend.currentOut}</strong> | período anterior: <strong>${report.movements.trend.previousOut}</strong> | variação: <strong>${pct(report.movements.trend.outDiffPct)}</strong></p>
          <p class="muted">Perdas atuais: <strong>${report.movements.trend.currentLosses}</strong> | período anterior: <strong>${report.movements.trend.previousLosses}</strong> | variação: <strong>${pct(report.movements.trend.lossesDiffPct)}</strong></p>
        </div>
        <div>${renderSimpleTable(["Produto", "SKU", "Consumo OUT"], report.movements.topConsumption.slice(0, 12).map((r) => [r.name, r.sku, String(r.quantity)]))}</div>
      </div>
    </section>

    <section class="section">
      <h2>5. Units / Assets</h2>
      <p>
        <span class="pill">Repair rate: ${pct(report.units.repairRatePct)}</span>
        <span class="pill">Loss/Scrap (30d): ${report.units.lossScrapLast30Days}</span>
      </p>
      ${renderSimpleTable(["Estado", "Qtd"], report.units.byStatus.map((r) => [r.status, String(r.count)]))}
    </section>

    <section class="section">
      <h2>6. Risk & Alerts</h2>
      <p class="muted">Stock rupture risk atual: <strong>${pct(report.risk.stockRuptureRiskPct)}</strong> | anterior: <strong>${pct(report.risk.stockRuptureRiskPrevPct)}</strong> | variação: <strong>${pct(report.risk.stockRuptureRiskDiffPct)}</strong></p>
      <p class="muted">Quarantine items: <strong>${report.risk.quarantineItems}</strong></p>
      <div class="narrative">
        <strong>Narrativa automática</strong>
        <ul>
          ${report.risk.narrative.map((n) => `<li>${esc(n)}</li>`).join("\n")}
        </ul>
      </div>
      ${renderSimpleTable(["Alertas críticos"], report.risk.criticalAlerts.length ? report.risk.criticalAlerts.map((a) => [a]) : [["Sem alertas críticos no período."]])}
    </section>

    <section class="section">
      <h2>7. Annex (Detailed Tables)</h2>
      ${renderSimpleTable(["#", "Produto", "SKU", "Consumo"], topConsumptionRows.length ? topConsumptionRows : [["1","—","—","0"]])}
      <div style="height: 8px"></div>
      ${renderSimpleTable(["#", "Alerta"], alertRows.length ? alertRows : [["1","Sem alertas"]])}
      <div style="height: 8px"></div>
      ${renderSimpleTable(["GTMI", "Título", "Estado", "Data", "Serviço"], pendingRows.length ? pendingRows : [["—","—","—","—","—"]])}
    </section>

    <div class="footer-hash">Document Hash (SHA-256): ${esc(report.meta.documentHash)}</div>
  </div>
</body>
</html>`;
}
