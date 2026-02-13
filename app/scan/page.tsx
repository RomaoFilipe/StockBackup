"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function getCameraErrorMessage(error: unknown, isSecureContext: boolean) {
  const err = error as { name?: string; message?: string } | null;
  const message = String(err?.message || "");
  const lower = message.toLowerCase();

  if (!isSecureContext) {
    return "O browser bloqueia a câmara em HTTP. Use HTTPS (ou localhost), ou usa o scan por foto.";
  }
  if (lower.includes("permissions policy")) {
    return "A câmara foi bloqueada pela política de permissões da app. Contacta o administrador.";
  }
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
    return "Permissão da câmara negada no browser. Autoriza a câmara e tenta novamente.";
  }
  if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
    return "Nenhuma câmara foi encontrada neste dispositivo.";
  }
  if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
    return "A câmara está ocupada por outra app/tab. Fecha outras apps e tenta novamente.";
  }
  if (err?.name === "OverconstrainedError") {
    return "Não foi possível iniciar a câmara com as definições pedidas.";
  }
  return message || "Não foi possível aceder à câmara.";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export default function ScanCameraPage() {
  const router = useRouter();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanLockRef = useRef(false);
  const scanLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const [isStarting, setIsStarting] = useState(true);
  const [cameraError, setCameraError] = useState<string>("");
  const [manualCode, setManualCode] = useState<string>("");
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const [cameraBootKey, setCameraBootKey] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const isSecureContext = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.isSecureContext || window.location.hostname === "localhost";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setIsStarting(true);
      setCameraError("");
      setTorchSupported(false);
      setTorchOn(false);
      scanLockRef.current = false;
      if (scanLockTimerRef.current) {
        clearTimeout(scanLockTimerRef.current);
        scanLockTimerRef.current = null;
      }

      try {
        if (!isSecureContext) {
          throw new Error("Insecure context");
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
            if (result && !scanLockRef.current) {
              scanLockRef.current = true;
              const text = result.getText?.() ?? String(result);
              const trimmed = text.trim();
              if (!isUuid(trimmed)) {
                toast({
                  title: "QR inválido",
                  description: "Este QR não contém um UUID de unidade válido.",
                  variant: "destructive",
                });
                scanLockTimerRef.current = setTimeout(() => {
                  scanLockRef.current = false;
                  scanLockTimerRef.current = null;
                }, 1200);
                return;
              }
              controls?.stop();
              controlsRef.current = null;
              router.replace(`/scan/${encodeURIComponent(trimmed)}`);
            }

            // Ignore scan errors; keep scanning
            void error;
            void controls;
          }
        );

        if (!cancelled) {
          controlsRef.current = controls;
          const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
          const track = stream?.getVideoTracks?.()[0] ?? null;
          videoTrackRef.current = track;
          if (track) {
            const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
            setTorchSupported(Boolean(caps.torch));
          }
        } else {
          controls.stop();
        }
      } catch (err: any) {
        if (!cancelled) setCameraError(getCameraErrorMessage(err, isSecureContext));
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (scanLockTimerRef.current) {
        clearTimeout(scanLockTimerRef.current);
        scanLockTimerRef.current = null;
      }
      videoTrackRef.current = null;
    };
  }, [isSecureContext, router, cameraBootKey, toast]);

  const navigateToCode = (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      toast({ title: "Código em falta", description: "Introduz ou faz scan de um código." });
      return;
    }
    if (!isUuid(trimmed)) {
      toast({
        title: "Código inválido",
        description: "Usa um UUID válido da unidade.",
        variant: "destructive",
      });
      return;
    }
    router.push(`/scan/${encodeURIComponent(trimmed)}`);
  };

  const openManual = () => {
    navigateToCode(manualCode);
  };

  const retryCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (scanLockTimerRef.current) {
      clearTimeout(scanLockTimerRef.current);
      scanLockTimerRef.current = null;
    }
    scanLockRef.current = false;
    videoTrackRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
    setCameraBootKey((v) => v + 1);
  };

  const toggleTorch = async () => {
    const track = videoTrackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] } as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      toast({
        title: "Lanterna indisponível",
        description: "Este dispositivo/browser não permitiu ativar a lanterna.",
        variant: "destructive",
      });
    }
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
        const trimmed = text?.trim();
        if (!trimmed || !isUuid(trimmed)) throw new Error("QR inválido: não contém UUID válido");
        router.replace(`/scan/${encodeURIComponent(trimmed)}`);
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
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-md bg-black aspect-video object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="pointer-events-none absolute inset-3 rounded-md border border-white/30">
                <div className="absolute left-3 top-3 h-7 w-7 border-l-2 border-t-2 border-white/80" />
                <div className="absolute right-3 top-3 h-7 w-7 border-r-2 border-t-2 border-white/80" />
                <div className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-white/80" />
                <div className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-white/80" />
              </div>
            </div>
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
                Dica: se não der para usar a câmara agora, usa o scan por foto abaixo ou introduz o UUID.
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={retryCamera}>
                Tentar novamente
              </Button>
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
            <Button variant="outline" onClick={toggleTorch} disabled={!torchSupported || isStarting || !!cameraError}>
              {torchOn ? "Desligar lanterna" : "Ligar lanterna"}
            </Button>
            <div className="text-xs text-muted-foreground sm:self-center">
              Funciona mesmo sem HTTPS (tirar foto ao QR). Lanterna depende do dispositivo.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Ou introduz o código manualmente (UUID)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openManual();
              }}
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
