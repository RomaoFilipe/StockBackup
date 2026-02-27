"use client";

import { useEffect, useMemo, useState } from "react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type Asset = {
  id: string;
  code: string;
  name: string;
  status: string;
  criticality: "OPERATIONAL" | "SECURITY" | "ESSENTIAL";
  serialNumber: string | null;
  assetTag: string | null;
  category: string | null;
  location: string | null;
  updatedAt: string;
  product: { id: string; sku: string; name: string } | null;
  productUnit: { id: string; code: string; status: string; serialNumber: string | null; assetTag: string | null } | null;
  class: { id: string; key: string; name: string; requiresSerialNumber: boolean } | null;
  model: { id: string; brand: string; model: string } | null;
  locationRef: { id: string; code: string | null; name: string; parentId: string | null } | null;
  requestingService: { id: number; codigo: string; designacao: string } | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  movements: Array<{ id: string; type: string; movementAt: string; statusTo: string | null }>;
};

type MetaPayload = {
  classes: Array<{ id: string; key: string; name: string; requiresSerialNumber: boolean; defaultUsefulLifeMonths: number | null; defaultDepreciationMethod: string | null }>;
  models: Array<{ id: string; brand: string; model: string; classId: string | null }>;
  locations: Array<{ id: string; code: string | null; name: string; parentId: string | null; level: number }>;
  products: Array<{ id: string; sku: string; name: string; categoryId: string; isPatrimonializable: boolean }>;
  units: Array<{ id: string; code: string; status: string; serialNumber: string | null; productId: string }>;
  users: Array<{ id: string; name: string | null; email: string }>;
  requestingServices: Array<{ id: number; codigo: string; designacao: string }>;
  categories: Array<{ id: string; name: string }>;
  categoryMaps: Array<{ id: string; categoryId: string; classId: string }>;
  policy: {
    id: string;
    requireTransferApproval: boolean;
    requireDisposalApproval: boolean;
    transferApproverRoleKey: string | null;
    disposalApproverRoleKey: string | null;
  } | null;
};

const STATUS_OPTIONS = [
  "REGISTERED",
  "IN_SERVICE",
  "IN_REPAIR",
  "LOANED",
  "LOST",
  "STOLEN",
  "TO_DISPOSE",
  "DISPOSED",
] as const;

const MOVEMENT_TYPES = [
  "ASSIGN",
  "TRANSFER",
  "STOCK_IN",
  "STOCK_OUT",
  "LOAN_OUT",
  "LOAN_RETURN",
  "REPAIR_OUT",
  "REPAIR_IN",
  "STATUS_CHANGE",
  "NOTE",
] as const;

export default function GovernancaPatrimonioPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Asset[]>([]);
  const [meta, setMeta] = useState<MetaPayload>({
    classes: [],
    models: [],
    locations: [],
    products: [],
    units: [],
    users: [],
    requestingServices: [],
    categories: [],
    categoryMaps: [],
    policy: null,
  });

  const [search, setSearch] = useState("");

  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createProductId, setCreateProductId] = useState("none");
  const [createUnitId, setCreateUnitId] = useState("none");
  const [createClassId, setCreateClassId] = useState("none");
  const [createModelId, setCreateModelId] = useState("none");
  const [createLocationId, setCreateLocationId] = useState("none");
  const [createServiceId, setCreateServiceId] = useState("none");
  const [createCustodianId, setCreateCustodianId] = useState("none");
  const [createCriticality, setCreateCriticality] = useState<"OPERATIONAL" | "SECURITY" | "ESSENTIAL">("OPERATIONAL");
  const [createStatus, setCreateStatus] = useState<string>("REGISTERED");
  const [createSerial, setCreateSerial] = useState("");
  const [createAssetTag, setCreateAssetTag] = useState("");

  const [classKey, setClassKey] = useState("");
  const [className, setClassName] = useState("");
  const [classReqSerial, setClassReqSerial] = useState("no");
  const [mapCategoryId, setMapCategoryId] = useState("none");
  const [mapClassId, setMapClassId] = useState("none");
  const [policyTransferApproval, setPolicyTransferApproval] = useState("yes");
  const [policyDisposalApproval, setPolicyDisposalApproval] = useState("yes");
  const [policyTransferRole, setPolicyTransferRole] = useState("");
  const [policyDisposalRole, setPolicyDisposalRole] = useState("");

  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationParentId, setLocationParentId] = useState("none");

  const [moveAssetId, setMoveAssetId] = useState("none");
  const [moveType, setMoveType] = useState<string>("TRANSFER");
  const [moveStatusTo, setMoveStatusTo] = useState("none");
  const [moveToServiceId, setMoveToServiceId] = useState("none");
  const [moveToLocationId, setMoveToLocationId] = useState("none");
  const [moveToCustodianId, setMoveToCustodianId] = useState("none");
  const [moveNote, setMoveNote] = useState("");

  const [disposeAssetId, setDisposeAssetId] = useState("none");
  const [disposeReasonCode, setDisposeReasonCode] = useState("");
  const [disposeReasonDetail, setDisposeReasonDetail] = useState("");

  const selectedCreateClass = useMemo(
    () => meta.classes.find((c) => c.id === createClassId) ?? null,
    [meta.classes, createClassId]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [
        row.code,
        row.name,
        row.status,
        row.product?.name || "",
        row.product?.sku || "",
        row.class?.name || "",
        row.locationRef?.name || row.location || "",
        row.serialNumber || "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get<{ items: Asset[]; meta: MetaPayload }>("/governanca/assets", {
        params: { includeMeta: true },
      });
      setRows(response.data.items || []);
      setMeta(
        response.data.meta || {
          classes: [],
          models: [],
          locations: [],
          products: [],
          units: [],
          users: [],
          requestingServices: [],
          categories: [],
          categoryMaps: [],
          policy: null,
        }
      );
    } catch (error: any) {
      toast({ title: "Património", description: error?.response?.data?.error || "Falha ao carregar ativos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!meta.policy) return;
    setPolicyTransferApproval(meta.policy.requireTransferApproval ? "yes" : "no");
    setPolicyDisposalApproval(meta.policy.requireDisposalApproval ? "yes" : "no");
    setPolicyTransferRole(meta.policy.transferApproverRoleKey || "");
    setPolicyDisposalRole(meta.policy.disposalApproverRoleKey || "");
  }, [meta.policy]);

  useEffect(() => {
    const product = meta.products.find((p) => p.id === createProductId);
    if (!product) return;
    const mapped = meta.categoryMaps.find((m) => m.categoryId === product.categoryId);
    if (mapped && createClassId === "none") {
      setCreateClassId(mapped.classId);
    }
  }, [meta.products, meta.categoryMaps, createProductId, createClassId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createAsset = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets", {
        code: createCode.trim() || undefined,
        name: createName.trim() || undefined,
        productId: createProductId === "none" ? null : createProductId,
        productUnitId: createUnitId === "none" ? null : createUnitId,
        classId: createClassId === "none" ? null : createClassId,
        modelId: createModelId === "none" ? null : createModelId,
        locationId: createLocationId === "none" ? null : createLocationId,
        requestingServiceId: createServiceId === "none" ? null : Number(createServiceId),
        assignedToUserId: createCustodianId === "none" ? null : createCustodianId,
        criticality: createCriticality,
        status: createStatus,
        serialNumber: createSerial.trim() || null,
        assetTag: createAssetTag.trim() || null,
      });
      toast({ title: "Património", description: "Ativo criado com sucesso." });
      setCreateCode("");
      setCreateName("");
      setCreateSerial("");
      setCreateAssetTag("");
      await load();
    } catch (error: any) {
      toast({ title: "Património", description: error?.response?.data?.error || "Não foi possível criar ativo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createClass = async () => {
    if (!classKey.trim() || !className.trim()) {
      toast({ title: "Catálogo", description: "Classe precisa de chave e nome.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets/catalog", {
        kind: "class",
        key: classKey,
        name: className,
        requiresSerialNumber: classReqSerial === "yes",
      });
      setClassKey("");
      setClassName("");
      setClassReqSerial("no");
      toast({ title: "Catálogo", description: "Classe criada." });
      await load();
    } catch (error: any) {
      toast({ title: "Catálogo", description: error?.response?.data?.error || "Falha ao criar classe.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createLocation = async () => {
    if (!locationName.trim()) {
      toast({ title: "Localização", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets/catalog", {
        kind: "location",
        code: locationCode.trim() || null,
        name: locationName,
        parentId: locationParentId === "none" ? null : locationParentId,
      });
      setLocationCode("");
      setLocationName("");
      setLocationParentId("none");
      toast({ title: "Localização", description: "Localização criada." });
      await load();
    } catch (error: any) {
      toast({ title: "Localização", description: error?.response?.data?.error || "Falha ao criar localização.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveCategoryMap = async () => {
    if (mapCategoryId === "none" || mapClassId === "none") {
      toast({ title: "Mapeamento", description: "Seleciona categoria e classe.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets/catalog", {
        kind: "categoryMap",
        categoryId: mapCategoryId,
        classId: mapClassId,
      });
      toast({ title: "Mapeamento", description: "Categoria mapeada para classe patrimonial." });
      await load();
    } catch (error: any) {
      toast({ title: "Mapeamento", description: error?.response?.data?.error || "Falha ao guardar mapeamento.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets/catalog", {
        kind: "policy",
        requireTransferApproval: policyTransferApproval === "yes",
        requireDisposalApproval: policyDisposalApproval === "yes",
        transferApproverRoleKey: policyTransferRole.trim() || null,
        disposalApproverRoleKey: policyDisposalRole.trim() || null,
      });
      toast({ title: "Política", description: "Política de aprovação guardada." });
      await load();
    } catch (error: any) {
      toast({ title: "Política", description: error?.response?.data?.error || "Falha ao guardar política.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createMovement = async () => {
    if (moveAssetId === "none") {
      toast({ title: "Movimentos", description: "Seleciona um ativo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets/movements", {
        assetId: moveAssetId,
        type: moveType,
        statusTo: moveStatusTo === "none" ? null : moveStatusTo,
        toRequestingServiceId: moveToServiceId === "none" ? null : Number(moveToServiceId),
        toLocationId: moveToLocationId === "none" ? null : moveToLocationId,
        toCustodianUserId: moveToCustodianId === "none" ? null : moveToCustodianId,
        note: moveNote.trim() || null,
      });
      setMoveNote("");
      toast({ title: "Movimentos", description: "Movimento registado." });
      await load();
    } catch (error: any) {
      toast({ title: "Movimentos", description: error?.response?.data?.error || "Falha ao registar movimento.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDisposal = async () => {
    if (disposeAssetId === "none" || !disposeReasonCode.trim()) {
      toast({ title: "Abate", description: "Seleciona ativo e motivo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets/disposals", {
        action: "OPEN",
        assetId: disposeAssetId,
        reasonCode: disposeReasonCode,
        reasonDetail: disposeReasonDetail.trim() || null,
      });
      setDisposeReasonCode("");
      setDisposeReasonDetail("");
      toast({ title: "Abate", description: "Processo de abate aberto." });
      await load();
    } catch (error: any) {
      toast({ title: "Abate", description: error?.response?.data?.error || "Falha ao abrir processo de abate.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader title="Património" description="Catálogo patrimonial, ativos ligados a Produtos, movimentos administrativos e abate." />

        <SectionCard title="Plano de Implementação" description="Checklist executável do módulo Património">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded border border-border/60 p-2">[x] Catálogo (classe/modelo) com regras por classe</div>
            <div className="rounded border border-border/60 p-2">[x] Ligação ao domínio Produtos e Unidades</div>
            <div className="rounded border border-border/60 p-2">[x] Estrutura orgânica + custódia + localização árvore</div>
            <div className="rounded border border-border/60 p-2">[x] Ledger de movimentos administrativos</div>
            <div className="rounded border border-border/60 p-2">[x] Estados de ciclo de vida com transições</div>
            <div className="rounded border border-border/60 p-2">[x] Processo de abate separado</div>
          </div>
        </SectionCard>

        <SectionCard
          title="Catálogo Base"
          description="Classes e localizações estruturadas para reduzir lixo de dados"
          actions={<Button variant="outline" onClick={() => void load()} disabled={loading}>Atualizar</Button>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="text-sm font-medium">Nova Classe</div>
              <Input placeholder="Chave (ex: TIC_PORTATIL)" value={classKey} onChange={(e) => setClassKey(e.target.value)} />
              <Input placeholder="Nome" value={className} onChange={(e) => setClassName(e.target.value)} />
              <Select value={classReqSerial} onValueChange={setClassReqSerial}>
                <SelectTrigger><SelectValue placeholder="Número de série obrigatório?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Número de série opcional</SelectItem>
                  <SelectItem value="yes">Número de série obrigatório</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => void createClass()} disabled={saving}>Criar classe</Button>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="text-sm font-medium">Nova Localização</div>
              <Input placeholder="Código (opcional)" value={locationCode} onChange={(e) => setLocationCode(e.target.value)} />
              <Input placeholder="Nome" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
              <Select value={locationParentId} onValueChange={setLocationParentId}>
                <SelectTrigger><SelectValue placeholder="Localização mãe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem mãe (raiz)</SelectItem>
                  {meta.locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{"-".repeat(l.level)} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => void createLocation()} disabled={saving}>Criar localização</Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="text-sm font-medium">Mapeamento Categoria -&gt; Classe</div>
              <Select value={mapCategoryId} onValueChange={setMapCategoryId}>
                <SelectTrigger><SelectValue placeholder="Categoria de produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar categoria</SelectItem>
                  {meta.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mapClassId} onValueChange={setMapClassId}>
                <SelectTrigger><SelectValue placeholder="Classe patrimonial" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar classe</SelectItem>
                  {meta.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => void saveCategoryMap()} disabled={saving}>Guardar mapeamento</Button>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="text-sm font-medium">Política de Aprovação</div>
              <Select value={policyTransferApproval} onValueChange={setPolicyTransferApproval}>
                <SelectTrigger><SelectValue placeholder="Transferência" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Transferência exige aprovação</SelectItem>
                  <SelectItem value="no">Transferência sem aprovação</SelectItem>
                </SelectContent>
              </Select>
              <Input value={policyTransferRole} onChange={(e) => setPolicyTransferRole(e.target.value)} placeholder="Role key aprovador transferência (opcional)" />
              <Select value={policyDisposalApproval} onValueChange={setPolicyDisposalApproval}>
                <SelectTrigger><SelectValue placeholder="Abate" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Abate exige aprovação</SelectItem>
                  <SelectItem value="no">Abate sem aprovação</SelectItem>
                </SelectContent>
              </Select>
              <Input value={policyDisposalRole} onChange={(e) => setPolicyDisposalRole(e.target.value)} placeholder="Role key aprovador abate (opcional)" />
              <Button size="sm" onClick={() => void savePolicy()} disabled={saving}>Guardar política</Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Novo Ativo Patrimonial"
          description="Criação ligada a Produto/Unidade com classe, custódia e localização"
          actions={<Button onClick={() => void createAsset()} disabled={saving}>{saving ? "A guardar..." : "Criar ativo"}</Button>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Código (opcional)</Label><Input value={createCode} onChange={(e) => setCreateCode(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Nome (opcional se houver Produto)</Label><Input value={createName} onChange={(e) => setCreateName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select value={createProductId} onValueChange={setCreateProductId}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem produto</SelectItem>
                  {meta.products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}{p.isPatrimonializable ? " • Patrimonial" : " • Consumível"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Unidade (Produto)</Label>
              <Select value={createUnitId} onValueChange={setCreateUnitId}>
                <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem unidade</SelectItem>
                  {meta.units
                    .filter((u) => createProductId === "none" || u.productId === createProductId)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.code} - {u.status}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select value={createClassId} onValueChange={setCreateClassId}>
                <SelectTrigger><SelectValue placeholder="Selecionar classe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem classe</SelectItem>
                  {meta.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select value={createModelId} onValueChange={setCreateModelId}>
                <SelectTrigger><SelectValue placeholder="Selecionar modelo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem modelo</SelectItem>
                  {meta.models
                    .filter((m) => createClassId === "none" || m.classId === createClassId)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.brand} {m.model}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Select value={createLocationId} onValueChange={setCreateLocationId}>
                <SelectTrigger><SelectValue placeholder="Selecionar localização" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem localização</SelectItem>
                  {meta.locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{"-".repeat(l.level)} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Serviço Responsável</Label>
              <Select value={createServiceId} onValueChange={setCreateServiceId}>
                <SelectTrigger><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem serviço</SelectItem>
                  {meta.requestingServices.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.codigo} - {s.designacao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Custódia (Pessoa)</Label>
              <Select value={createCustodianId} onValueChange={setCreateCustodianId}>
                <SelectTrigger><SelectValue placeholder="Selecionar pessoa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem custódia</SelectItem>
                  {meta.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={createStatus} onValueChange={setCreateStatus}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Criticidade</Label>
              <Select value={createCriticality} onValueChange={(v) => setCreateCriticality(v as any)}>
                <SelectTrigger><SelectValue placeholder="Criticidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATIONAL">Operacional</SelectItem>
                  <SelectItem value="SECURITY">Segurança</SelectItem>
                  <SelectItem value="ESSENTIAL">Essencial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5"><Label>Número de Série</Label><Input value={createSerial} onChange={(e) => setCreateSerial(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Etiqueta Patrimonial</Label><Input value={createAssetTag} onChange={(e) => setCreateAssetTag(e.target.value)} /></div>
          </div>
          {selectedCreateClass?.requiresSerialNumber ? (
            <div className="mt-2 text-xs text-amber-600">A classe selecionada exige número de série.</div>
          ) : null}
        </SectionCard>

        <SectionCard title="Movimento Administrativo" description="Afetação, transferência, empréstimo e reparação">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Ativo</Label>
              <Select value={moveAssetId} onValueChange={setMoveAssetId}>
                <SelectTrigger><SelectValue placeholder="Selecionar ativo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar</SelectItem>
                  {rows.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={moveType} onValueChange={setMoveType}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>{MOVEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado destino (opcional)</Label>
              <Select value={moveStatusTo} onValueChange={setMoveStatusTo}>
                <SelectTrigger><SelectValue placeholder="Sem alteração" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem alteração</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Serviço destino</Label>
              <Select value={moveToServiceId} onValueChange={setMoveToServiceId}>
                <SelectTrigger><SelectValue placeholder="Sem alteração" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem alteração</SelectItem>
                  {meta.requestingServices.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.codigo} - {s.designacao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Localização destino</Label>
              <Select value={moveToLocationId} onValueChange={setMoveToLocationId}>
                <SelectTrigger><SelectValue placeholder="Sem alteração" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem alteração</SelectItem>
                  {meta.locations.map((l) => <SelectItem key={l.id} value={l.id}>{"-".repeat(l.level)} {l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Custódia destino</Label>
              <Select value={moveToCustodianId} onValueChange={setMoveToCustodianId}>
                <SelectTrigger><SelectValue placeholder="Sem alteração" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem alteração</SelectItem>
                  {meta.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input placeholder="Observações do movimento" value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
            <Button onClick={() => void createMovement()} disabled={saving}>Registar movimento</Button>
          </div>
        </SectionCard>

        <SectionCard title="Processo de Abate" description="Processo formal separado do ativo (motivo + avaliação)">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Ativo</Label>
              <Select value={disposeAssetId} onValueChange={setDisposeAssetId}>
                <SelectTrigger><SelectValue placeholder="Selecionar ativo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar</SelectItem>
                  {rows.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Motivo (código)</Label><Input value={disposeReasonCode} onChange={(e) => setDisposeReasonCode(e.target.value)} placeholder="OBSOLESCENCIA / FURTO / AVARIA" /></div>
            <div className="space-y-1.5"><Label>Detalhe</Label><Input value={disposeReasonDetail} onChange={(e) => setDisposeReasonDetail(e.target.value)} placeholder="Descrição técnica" /></div>
          </div>
          <div className="mt-3"><Button onClick={() => void openDisposal()} disabled={saving}>Abrir processo de abate</Button></div>
        </SectionCard>

        <SectionCard title="Inventário Patrimonial" description={loading ? "A carregar..." : `${filteredRows.length} ativo(s)`}>
          <div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input placeholder="Pesquisar por código, nome, produto, classe, série..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="outline" onClick={() => void load()} disabled={loading}>Atualizar</Button>
          </div>

          <div className="space-y-2">
            {filteredRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{row.code} - {row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Produto: {row.product ? `${row.product.sku} - ${row.product.name}` : "sem ligação"} •
                      Classe: {row.class?.name || "n/d"} •
                      Localização: {row.locationRef?.name || row.location || "n/d"} •
                      Custódia: {row.assignedTo?.name || row.assignedTo?.email || "n/d"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Último movimento: {row.movements[0] ? `${row.movements[0].type} em ${new Date(row.movements[0].movementAt).toLocaleString()}` : "sem movimentos"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{row.criticality}</Badge>
                    <Badge>{row.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
            {!loading && filteredRows.length === 0 ? <div className="text-sm text-muted-foreground">Sem ativos para os filtros atuais.</div> : null}
          </div>
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}
