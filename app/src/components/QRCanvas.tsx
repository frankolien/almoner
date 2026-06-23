import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

// A QR code is only scannable if its module edges land on whole pixels. If the
// browser has to *resample* it (CSS-scaling an <img>, downscaling a 2x PNG), the
// edges blur and a camera can't read it — which is exactly why the old QR failed.
// So we render straight onto a <canvas> at the device pixel grid: each module is
// an integer number of device pixels (no resampling), then we display the canvas
// at deviceSize / devicePixelRatio CSS px → pixel-perfect on any screen + dpr.
export default function QRCanvas({ url, max = 320 }: { url: string; max?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const render = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const margin = 4; // quiet zone (modules) — scanners require it
      const ecc = 'L' as const; // fewest modules → biggest squares; a clean screen needs no extra recovery
      const target = Math.min(max, wrap.clientWidth || max);
      const count = QRCode.create(url, { errorCorrectionLevel: ecc }).modules.size;
      const total = count + margin * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const scale = Math.max(2, Math.floor((target * dpr) / total)); // integer device px per module
      QRCode.toCanvas(
        canvas,
        url,
        { scale, margin, errorCorrectionLevel: ecc, color: { dark: '#0b0a0a', light: '#ffffff' } },
        (err) => {
          if (err) return console.error('[qr]', err);
          const cssPx = canvas.width / dpr; // show device pixels 1:1 → never resampled
          canvas.style.width = `${cssPx}px`;
          canvas.style.height = `${cssPx}px`;
        },
      );
    };
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [url, max]);

  return (
    <div ref={wrapRef} style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
      <canvas ref={canvasRef} aria-label="Claim QR code" style={{ display: 'block', borderRadius: 8 }} />
    </div>
  );
}
