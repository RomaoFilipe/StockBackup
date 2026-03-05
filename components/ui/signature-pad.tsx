"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
};

type SignaturePadProps = {
  height?: number;
  className?: string;
  penColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      height = 180,
      className,
      penColor = "#0f172a",
      backgroundColor = "#ffffff",
      disabled = false,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    const [empty, setEmpty] = useState(true);
    const emptyRef = useRef(true);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const dpr = useMemo(() => {
      if (typeof window === "undefined") return 1;
      return clamp(window.devicePixelRatio || 1, 1, 3);
    }, []);

    const paintBackground = useCallback(() => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }, [backgroundColor]);

    const initCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      const widthCss = parent ? parent.clientWidth : canvas.clientWidth;
      const width = Math.max(1, Math.floor(widthCss * dpr));
      const heightPx = Math.max(1, Math.floor(height * dpr));

      canvas.width = width;
      canvas.height = heightPx;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctxRef.current = ctx;

      ctx.lineWidth = 2.25 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = penColor;

      paintBackground();

      emptyRef.current = true;
      setEmpty(true);
      drawingRef.current = false;
      lastPointRef.current = null;
    }, [dpr, height, paintBackground, penColor]);

    useEffect(() => {
      initCanvas();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      if (!parent || typeof ResizeObserver === "undefined") return;

      const ro = new ResizeObserver(() => {
        // Keep correct scale without losing the drawing (mobile keyboard/orientation).
        const currentCanvas = canvasRef.current;
        const hadDrawing = currentCanvas && !emptyRef.current;
        const snapshot = hadDrawing && currentCanvas ? currentCanvas.toDataURL("image/png") : null;

        initCanvas();

        if (snapshot) {
          const img = new window.Image();
          img.onload = () => {
            const ctx = ctxRef.current;
            const c = canvasRef.current;
            if (!ctx || !c) return;
            ctx.drawImage(img, 0, 0, c.width, c.height);
            emptyRef.current = false;
            setEmpty(false);
          };
          img.src = snapshot;
        }
      });

      ro.observe(parent);
      return () => ro.disconnect();
    }, [initCanvas]);

    const clientPointToCanvas = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * dpr;
        const y = (event.clientY - rect.top) * dpr;
        return { x, y };
      },
      [dpr]
    );

    const onPointerDown = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

        canvas.setPointerCapture?.(event.pointerId);
        drawingRef.current = true;
        lastPointRef.current = clientPointToCanvas(event);
      },
      [clientPointToCanvas, disabled]
    );

    const onPointerMove = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        if (!drawingRef.current) return;

        const ctx = ctxRef.current;
        if (!ctx) return;

        const p = clientPointToCanvas(event);
        const last = lastPointRef.current;
        if (!p || !last) {
          lastPointRef.current = p;
          return;
        }

        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        lastPointRef.current = p;
        if (empty) {
          emptyRef.current = false;
          setEmpty(false);
        }
      },
      [clientPointToCanvas, disabled, empty]
    );

    const endStroke = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        drawingRef.current = false;
        lastPointRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      },
      [disabled]
    );

    const clear = useCallback(() => {
      initCanvas();
    }, [initCanvas]);

    const toDataURL = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      return canvas.toDataURL("image/png");
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        clear,
        isEmpty: () => empty,
        toDataURL,
      }),
      [clear, empty, toDataURL]
    );

    return (
      <canvas
        ref={canvasRef}
        className={
          className ??
          "w-full rounded-md border border-input bg-background touch-none select-none"
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        aria-label="Assinatura"
        role="img"
      />
    );
  }
);
