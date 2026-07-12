'use client';

/**
 * components/SignaturePad.tsx
 *
 * Minimal canvas-based signature capture — no external dependency. Used by
 * the Phase 3 "Digital signature capture at delivery" flow
 * (app/(dashboard)/shipments/[id]/page.tsx) to produce the
 * `signatureImageDataUrl` the /delivery-signature API expects.
 *
 * Exposes an imperative handle (getDataUrl / clear / isEmpty) rather than
 * controlled state, since re-rendering a canvas on every stroke would be
 * wasteful and isn't needed — the parent only reads the drawing once, on
 * submit.
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface SignaturePadHandle {
  /** Returns a base64 PNG data URL, or null if nothing has been drawn. */
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  className?: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ width = 500, height = 160, className = '' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasDrawnRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmptyState, setIsEmptyState] = useState(true);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPointRef.current = getPoint(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !lastPointRef.current) return;
      const point = getPoint(e);
      ctx.strokeStyle = '#161616';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      if (!hasDrawnRef.current) {
        hasDrawnRef.current = true;
        setIsEmptyState(false);
      }
    };

    const stopDrawing = () => {
      drawingRef.current = false;
      lastPointRef.current = null;
    };

    useImperativeHandle(ref, () => ({
      getDataUrl: () => {
        if (!hasDrawnRef.current || !canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
      },
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawnRef.current = false;
        setIsEmptyState(true);
      },
      isEmpty: () => !hasDrawnRef.current,
    }));

    return (
      <div className={`relative ${className}`}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none bg-mist-light rounded-xl border border-mist cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        {isEmptyState && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-ink-faint/60 pointer-events-none select-none">
            Sign here with mouse or finger
          </p>
        )}
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;
