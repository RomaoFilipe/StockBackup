"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Boxes,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  Rows3,
  Search,
  Settings,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";

type StorageKind = "INVOICE" | "REQUEST" | "DOCUMENT" | "OTHER";
type SortOption = "newest" | "oldest" | "name_asc" | "size_desc";
type ViewMode = "list" | "grid";

type StoredFileDto = {
  id: string;
  kind: StorageKind;
  originalName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  invoiceId?: string | null;
  requestId?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KINDS: StorageKind[] = ["INVOICE", "REQUEST", "DOCUMENT", "OTHER"];
const SOFT_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

const KIND_META: Record<
  StorageKind,
  { label: string; tab: string; icon: React.ComponentType<{ className?: string }> }
> = {
  INVOICE: { label: "Faturas", tab: "invoices", icon: FileText },
  REQUEST: { label: "Requisições", tab: "requests", icon: ClipboardList },
  DOCUMENT: { label: "Documentos", tab: "documents", icon: FolderOpen },
  OTHER: { label: "Outros", tab: "other", icon: Boxes },
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toKindFromTab = (tab?: string | null): StorageKind => {
  if (tab === "requests") return "REQUEST";
  if (tab === "documents") return "DOCUMENT";
  if (tab === "other") return "OTHER";
  return "INVOICE";
};

const toTabFromKind = (kind: StorageKind) => KIND_META[kind].tab;

function getStatusMeta(createdAt: string) {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours <= 24) {
    return {
      label: "Novo",
      className:
        "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (hours <= 24 * 14) {
    return {
      label: "Ativo",
      className:
        "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    };
  }
  return {
    label: "Arquivo",
    className:
      "border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  };
}

export default function StoragePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isAuthLoading } = useAuth();
  const { toast } = useToast();

  const initialKind = useMemo(() => toKindFromTab(searchParams?.get("tab")), [searchParams]);
  const [activeKind, setActiveKind] = useState<StorageKind>(initialKind);
  const [filesByKind, setFilesByKind] = useState<Record<StorageKind, StoredFileDto[]>>({
    INVOICE: [],
    REQUEST: [],
    DOCUMENT: [],
    OTHER: [],
  });
  const [quickSearch, setQuickSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveKind(initialKind);
  }, [initialKind]);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  const loadAllKinds = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const responses = await Promise.all(
        STORAGE_KINDS.map((kind) => axiosInstance.get("/storage", { params: { kind } }))
      );
      const next: Record<StorageKind, StoredFileDto[]> = {
        INVOICE: [],
        REQUEST: [],
        DOCUMENT: [],
        OTHER: [],
      };
      STORAGE_KINDS.forEach((kind, idx) => {
        next[kind] = (responses[idx]?.data || []).sort(
          (a: StoredFileDto, b: StoredFileDto) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setFilesByKind(next);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar o storage.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllKinds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allFiles = useMemo(
    () =>
      STORAGE_KINDS.flatMap((kind) => filesByKind[kind]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [filesByKind]
  );

  const totalBytes = useMemo(
    () =>
      allFiles.reduce((acc, file) => acc + (Number.isFinite(file.sizeBytes) ? file.sizeBytes : 0), 0),
    [allFiles]
  );

  const topCategory = useMemo(() => {
    const ranked = STORAGE_KINDS.map((kind) => ({ kind, count: filesByKind[kind].length })).sort(
      (a, b) => b.count - a.count
    );
    if (!ranked.length || ranked[0].count === 0) return "Sem dados";
    return KIND_META[ranked[0].kind].label;
  }, [filesByKind]);

  const usagePct = Math.min(100, Math.round((totalBytes / SOFT_QUOTA_BYTES) * 100));
  const latestUpload = allFiles[0]?.createdAt ? formatDate(allFiles[0].createdAt) : "Sem uploads";

  const categorySeries = useMemo(
    () => STORAGE_KINDS.map((kind) => Math.max(1, Math.min(10, filesByKind[kind].length || 1))),
    [filesByKind]
  );

  const activeFiles = filesByKind[activeKind] || [];
  const combinedSearch = `${quickSearch} ${fileSearch}`.trim().toLowerCase();

  const visibleFiles = useMemo(() => {
    let rows = [...activeFiles];
    if (combinedSearch) {
      rows = rows.filter((f) => `${f.originalName} ${f.mimeType} ${f.fileName}`.toLowerCase().includes(combinedSearch));
    }
    rows.sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "name_asc") return a.originalName.localeCompare(b.originalName, "pt");
      if (sortBy === "size_desc") return b.sizeBytes - a.sizeBytes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [activeFiles, combinedSearch, sortBy]);

  const setActiveKindAndUrl = (kind: StorageKind) => {
    setActiveKind(kind);
    router.replace(`/storage?tab=${toTabFromKind(kind)}`);
  };

  const uploadFile = async (inputFile: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("kind", activeKind);
      fd.append("file", inputFile);

      const res = await fetch("/api/storage", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha no upload");
      }

      const created = (await res.json()) as StoredFileDto;
      setFilesByKind((prev) => ({
        ...prev,
        [activeKind]: [created, ...prev[activeKind]],
      }));
      toast({
        title: "Upload concluído",
        description: `Ficheiro enviado para ${KIND_META[activeKind].label}.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error?.message || "Não foi possível enviar o ficheiro.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = (id: string) => {
    window.open(`/api/storage/${id}`, "_blank", "noopener,noreferrer");
  };

  const removeFile = async (id: string) => {
    try {
      await axiosInstance.delete(`/storage/${id}`);
      setFilesByKind((prev) => ({
        ...prev,
        [activeKind]: prev[activeKind].filter((f) => f.id !== id),
      }));
      toast({ title: "Ficheiro removido" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const openPicker = () => uploadInputRef.current?.click();

  return (
    <AuthenticatedLayout>
      <div className="storage-page space-y-6">
        <div className="storage-topbar glass-panel">
          <div className="storage-topbar-left">
            <div className="storage-avatar-chip">
              <UserRound className="h-4 w-4" />
              <span>CMCHUB Team</span>
            </div>
          </div>
          <div className="storage-topbar-search">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Pesquisar ficheiros, tipo, nome..."
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="storage-topbar-actions">
            <button type="button" className="storage-icon-btn" aria-label="Notificações">
              <Bell className="h-4 w-4" />
              <span className="storage-dot" />
            </button>
            <button type="button" className="storage-icon-btn" aria-label="Definições">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <section className="storage-hero glass-panel">
          <div>
            <h1 className="storage-title">Storage</h1>
            <p className="storage-subtitle">
              Gestão inteligente de ficheiros locais com organização por categoria, estado e utilização.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => loadAllKinds(true)}
              disabled={refreshing || loading}
              className="h-11 rounded-2xl border-border/70 px-4"
            >
              {refreshing ? "A atualizar..." : "Atualizar"}
            </Button>
            <Button
              onClick={openPicker}
              disabled={uploading || loading}
              className="h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-white shadow-[0_10px_28px_rgba(59,130,246,0.28)] hover:from-blue-500 hover:to-indigo-500"
            >
              <UploadCloud className="h-4 w-4" />
              {uploading ? "A enviar..." : "Upload Ficheiro"}
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) {
                  uploadFile(picked);
                }
                e.currentTarget.value = "";
              }}
            />
          </div>
        </section>

        <section className="storage-overview-grid">
          <article className="storage-overview-card">
            <div className="storage-overview-head">
              <span>Total de Ficheiros</span>
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="storage-overview-value">{allFiles.length}</div>
            <div className="storage-sparkline">
              {categorySeries.map((value, idx) => (
                <span key={idx} style={{ height: `${value * 10}%` }} />
              ))}
            </div>
          </article>

          <article className="storage-overview-card">
            <div className="storage-overview-head">
              <span>Espaço Utilizado</span>
              <HardDrive className="h-4 w-4 text-primary" />
            </div>
            <div className="storage-overview-value">{formatBytes(totalBytes)}</div>
            <div className="storage-progress-wrap">
              <div className="storage-progress-bar" style={{ width: `${usagePct}%` }} />
            </div>
            <div className="storage-overview-foot">{usagePct}% da quota de referência (5 GB)</div>
          </article>

          <article className="storage-overview-card">
            <div className="storage-overview-head">
              <span>Último Upload</span>
              <CalendarClock className="h-4 w-4 text-primary" />
            </div>
            <div className="storage-overview-value text-xl sm:text-2xl">{latestUpload}</div>
            <div className="storage-sparkline">
              {[2, 6, 4, 8, 5, 7, 3, 6].map((value, idx) => (
                <span key={idx} style={{ height: `${value * 10}%` }} />
              ))}
            </div>
          </article>

          <article className="storage-overview-card">
            <div className="storage-overview-head">
              <span>Categoria Mais Usada</span>
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <div className="storage-overview-value">{topCategory}</div>
            <div className="storage-overview-foot">
              Atualizado com base na distribuição atual de ficheiros.
            </div>
          </article>
        </section>

        <section className="storage-main-layout">
          <aside className="storage-kind-rail glass-panel group">
            {STORAGE_KINDS.map((kind) => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              const isActive = kind === activeKind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActiveKindAndUrl(kind)}
                  className={`storage-kind-btn ${isActive ? "is-active" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="storage-kind-label">{meta.label}</span>
                  <span className="storage-kind-count">{filesByKind[kind].length}</span>
                </button>
              );
            })}
          </aside>

          <div className="storage-files-panel glass-panel">
            <div className="storage-files-toolbar">
              <div className="storage-inline-search">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder={`Pesquisar em ${KIND_META[activeKind].label.toLowerCase()}...`}
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="h-10 min-w-44 rounded-xl border-border/70 bg-[hsl(var(--surface-1)/0.7)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  <SelectItem value="newest">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="name_asc">Nome A-Z</SelectItem>
                  <SelectItem value="size_desc">Tamanho (maior)</SelectItem>
                </SelectContent>
              </Select>

              <div className="storage-toggle">
                <button
                  type="button"
                  className={viewMode === "list" ? "is-on" : ""}
                  onClick={() => setViewMode("list")}
                  aria-label="Modo lista"
                >
                  <Rows3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={viewMode === "grid" ? "is-on" : ""}
                  onClick={() => setViewMode("grid")}
                  aria-label="Modo grelha"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className={`storage-dropzone ${dragging ? "is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) uploadFile(dropped);
              }}
            >
              <UploadCloud className="h-5 w-5 text-primary" />
              <span>Largue ficheiros aqui para upload rápido em {KIND_META[activeKind].label}</span>
              <button type="button" onClick={openPicker}>
                Escolher ficheiro
              </button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">A carregar ficheiros...</div>
            ) : visibleFiles.length === 0 ? (
              <div className="storage-empty">
                <div className="storage-empty-illustration">
                  <FolderOpen className="h-8 w-8 text-primary" />
                </div>
                <h3>Sem ficheiros nesta vista</h3>
                <p>Use pesquisa, altere a categoria ou faça upload para começar.</p>
                <Button onClick={openPicker} className="rounded-xl">
                  <UploadCloud className="h-4 w-4" />
                  Carregar ficheiro
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="storage-file-grid">
                {visibleFiles.map((file) => {
                  const status = getStatusMeta(file.createdAt);
                  return (
                    <article key={file.id} className="storage-file-card">
                      <div className="storage-file-card-head">
                        <div className="storage-file-icon">
                          <FileText className="h-4 w-4" />
                        </div>
                        <Badge className={`rounded-full border ${status.className}`} variant="outline">
                          {status.label}
                        </Badge>
                      </div>
                      <h4 title={file.originalName}>{file.originalName}</h4>
                      <p>{formatBytes(file.sizeBytes)} • {formatDate(file.createdAt)}</p>
                      <div className="storage-file-actions">
                        <Button
                          variant="outline"
                          className="h-9 rounded-xl border-border/70"
                          onClick={() => downloadFile(file.id)}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          className="h-9 rounded-xl border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Apagar
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="storage-table-wrap">
                <table className="storage-table">
                  <thead>
                    <tr>
                      <th>Ficheiro</th>
                      <th>Nome</th>
                      <th>Tamanho</th>
                      <th>Data</th>
                      <th>Estado</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFiles.map((file) => {
                      const status = getStatusMeta(file.createdAt);
                      return (
                        <tr key={file.id}>
                          <td>
                            <div className="storage-file-icon">
                              <FileText className="h-4 w-4" />
                            </div>
                          </td>
                          <td>
                            <span className="block max-w-[36ch] truncate" title={file.originalName}>
                              {file.originalName}
                            </span>
                          </td>
                          <td>{formatBytes(file.sizeBytes)}</td>
                          <td>{formatDate(file.createdAt)}</td>
                          <td>
                            <Badge className={`rounded-full border ${status.className}`} variant="outline">
                              {status.label}
                            </Badge>
                          </td>
                          <td>
                            <div className="storage-actions-right">
                              <Button
                                variant="outline"
                                className="h-9 rounded-xl border-border/70"
                                onClick={() => downloadFile(file.id)}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                className="h-9 rounded-xl border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                onClick={() => removeFile(file.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Apagar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
}
