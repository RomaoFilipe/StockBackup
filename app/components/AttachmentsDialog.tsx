"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export type StorageKind = "INVOICE" | "REQUEST" | "DOCUMENT" | "OTHER";

type StoredFileDto = {
  id: string;
  kind: StorageKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  invoiceId?: string | null;
  requestId?: string | null;
  createdAt: string;
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

type BaseProps = {
  buttonText?: string;
  title?: string;
  description?: string;
  trigger?: ReactNode;
};

type Props =
  | (BaseProps & {
      kind: "INVOICE";
      invoiceId: string;
    })
  | (BaseProps & {
      kind: "REQUEST";
      requestId: string;
    });

export default function AttachmentsDialog(props: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<StoredFileDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const buttonText = props.buttonText ?? "Anexos";
  const title = props.title ?? "Anexos";
  const description =
    props.description ?? "Upload/download de ficheiros associados a este item.";

  const canUpload = useMemo(() => Boolean(file), [file]);

  const params = useMemo(() => {
    if (props.kind === "INVOICE") {
      return { kind: "INVOICE" as const, invoiceId: props.invoiceId };
    }
    return { kind: "REQUEST" as const, requestId: props.requestId };
  }, [props]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/storage", { params });
      setFiles(res.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar anexos.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("kind", props.kind);
      fd.append("file", file);
      if (props.kind === "INVOICE") fd.append("invoiceId", props.invoiceId);
      if (props.kind === "REQUEST") fd.append("requestId", props.requestId);

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
      toast({
        title: "Erro",
        description: error?.message || "Falha no upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const download = (id: string) => {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.trigger ?? (
          <Button variant="outline" size="sm">
            {buttonText}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? "A carregar..." : "Atualizar"}
              </Button>
              <Button onClick={upload} disabled={!canUpload || uploading}>
                {uploading ? "A enviar..." : "Upload"}
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar...</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem anexos.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium break-all">{f.originalName}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(f.sizeBytes)} • {new Date(f.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => download(f.id)}>
                        Download
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => remove(f.id)}>
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
