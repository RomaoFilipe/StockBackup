"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import EmptyState from "@/app/components/EmptyState";
import SectionCard from "@/app/components/SectionCard";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCcw, Trash2, UploadCloud } from "lucide-react";

type StorageKind = "INVOICE" | "REQUEST" | "DOCUMENT" | "OTHER";

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

function StoragePane({ kind, title }: { kind: StorageKind; title: string }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<StoredFileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const canUpload = useMemo(() => Boolean(file), [file]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/storage", { params: { kind } });
      setFiles(res.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar ficheiros.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);

      const res = await fetch("/api/storage", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Upload failed");
      }

      const created = (await res.json()) as StoredFileDto;
      setFiles((prev) => [created, ...prev]);
      setFile(null);
      toast({ title: "Upload concluído" });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha no upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const download = async (id: string) => {
    window.open(`/api/storage/${id}`, "_blank", "noopener,noreferrer");
  };

  const remove = async (id: string) => {
    try {
      await axiosInstance.delete(`/storage/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast({ title: "Removido" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title={title}
        description="Uploads locais (guardados em disco) + index no Postgres."
        className="border-border/60 bg-card/60"
        actions={
          <Button
            variant="outline"
            onClick={() => loadFiles()}
            disabled={loading}
            className="h-10 rounded-xl"
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? "A carregar..." : "Atualizar"}
          </Button>
        }
      >
        <div className="space-y-3">
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="h-11 rounded-xl"
          />
          <div className="flex items-center justify-end">
            <Button onClick={upload} disabled={!canUpload || uploading} className="h-10 rounded-xl">
              <UploadCloud className="h-4 w-4" />
              {uploading ? "A enviar..." : "Fazer upload"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div className="text-sm text-muted-foreground">A carregar ficheiros...</div>
      ) : files.length === 0 ? (
        <EmptyState title="Sem ficheiros" description="Ainda não há ficheiros neste separador." />
      ) : (
        <SectionCard
          title="Ficheiros"
          description={`Lista por tipo: ${kind}`}
          className="border-border/60 bg-card/60"
        >
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="rounded-2xl border border-border/60 bg-background/40 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium break-all">{f.originalName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(f.sizeBytes)} • {new Date(f.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => download(f.id)} className="h-9 rounded-full">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="destructive" onClick={() => remove(f.id)} className="h-9 rounded-full">
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default function StoragePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isAuthLoading } = useAuth();

  const tabParam = searchParams?.get("tab");
  const initialTab = useMemo(() => {
    if (tabParam === "invoices") return "invoices";
    if (tabParam === "requests") return "requests";
    if (tabParam === "documents") return "documents";
    if (tabParam === "other") return "other";
    return "invoices";
  }, [tabParam]);

  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="Storage"
          description="Organização de ficheiros: Faturas, Requisições, Documentos e Outros."
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-11 w-full justify-start rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="invoices" className="rounded-xl px-4">Faturas</TabsTrigger>
            <TabsTrigger value="requests" className="rounded-xl px-4">Requisições</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-xl px-4">Documentos</TabsTrigger>
            <TabsTrigger value="other" className="rounded-xl px-4">Outros</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <StoragePane kind="INVOICE" title="Storage • Faturas" />
          </TabsContent>
          <TabsContent value="requests">
            <StoragePane kind="REQUEST" title="Storage • Requisições" />
          </TabsContent>
          <TabsContent value="documents">
            <StoragePane kind="DOCUMENT" title="Storage • Documentos" />
          </TabsContent>
          <TabsContent value="other">
            <StoragePane kind="OTHER" title="Storage • Outros" />
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedLayout>
  );
}
