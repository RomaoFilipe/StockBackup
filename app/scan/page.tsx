"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function ScanCameraPage() {
  const router = useRouter();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isStarting, setIsStarting] = useState(true);
  const [cameraError, setCameraError] = useState<string>("");
  const [manualCode, setManualCode] = useState<string>("");
  const [isDecodingImage, setIsDecodingImage] = useState(false);

  const isSecureContext = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.isSecureContext || window.location.hostname === "localhost";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setIsStarting(true);
      setCameraError("");

      try {
        if (!isSecureContext) {
          throw new Error(
            "O browser bloqueia a câmara em HTTP. Use HTTPS (ou localhost) — ou use o scan por foto abaixo."
          );
        }

        const video = videoRef.current;
        if (!video) return;

        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
            },
          },
          video,
          (result, error, controls) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText?.() ?? String(result);
              controls?.stop();
              controlsRef.current = null;
              router.replace(`/scan/${encodeURIComponent(text)}`);
            }

            // Ignore scan errors; keep scanning
            void error;
            void controls;
          }
        );

        if (!cancelled) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (err: any) {
        const message = err?.message || "Não foi possível aceder à câmara.";
        if (!cancelled) setCameraError(message);
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isSecureContext, router]);

  const openManual = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      toast({ title: "Código em falta", description: "Introduz ou faz scan de um código." });
      return;
    }

    router.push(`/scan/${encodeURIComponent(trimmed)}`);
  };

  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  const onPickImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsDecodingImage(true);
    try {
      const url = URL.createObjectURL(file);
      try {
        const reader = new BrowserMultiFormatReader();
        const result = await (reader as any).decodeFromImageUrl(url);
        const text = result?.getText?.() ?? String(result);
        if (!text?.trim()) throw new Error("QR inválido");
        router.replace(`/scan/${encodeURIComponent(text)}`);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      toast({
        title: "Não foi possível ler o QR",
        description: err?.message || "Tente novamente com uma foto mais nítida.",
        variant: "destructive",
      });
    } finally {
      setIsDecodingImage(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan • Câmara</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/10 p-3">
            <video
              ref={videoRef}
              className="w-full rounded-md bg-black aspect-video object-cover"
              playsInline
              muted
              autoPlay
            />
            <div className="mt-2 text-xs text-muted-foreground">
              Aponte a câmara ao QR. Ao ler, abre automaticamente o detalhe.
            </div>
          </div>

          {isStarting ? <div className="text-sm text-muted-foreground">A iniciar câmara…</div> : null}

          {cameraError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="font-medium">Não foi possível usar a câmara</div>
              <div className="text-muted-foreground">{cameraError}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Dica: a câmara no browser precisa de HTTPS. Se estiveres a abrir pelo IP (http://...),
                usa um domínio com SSL / reverse proxy, ou então usa o scan por foto.
              </div>
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickImage}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={openImagePicker} disabled={isDecodingImage}>
              {isDecodingImage ? "A ler foto…" : "Scan por foto"}
            </Button>
            <div className="text-xs text-muted-foreground sm:self-center">
              Funciona mesmo sem HTTPS (tirar foto ao QR).
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Ou introduz o código manualmente (UUID)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <Button onClick={openManual} className="sm:w-[180px]">
              Abrir
            </Button>
          </div>

          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={() => router.push("/movements")}
            >
              Ver movimentos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
