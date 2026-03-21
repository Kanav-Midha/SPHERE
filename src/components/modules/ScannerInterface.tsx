import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraOff, CheckCircle2, XCircle, Hash } from 'lucide-react';
import jsQR from 'jsqr';
import { useOperatorSessionStore } from '../../store/useOperatorSessionStore';
import { useToastStore } from '../../store/useToastStore';

type ScanStatus = 'idle' | 'scanning' | 'valid' | 'invalid' | 'already_scanned';

interface ScannerInterfaceProps {
  onScanComplete?: () => void;
}

interface BarcodeResult {
  rawValue?: string;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};

interface ScanFeedback {
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  message?: string | null;
}

export default function ScannerInterface({ onScanComplete }: ScannerInterfaceProps) {
  const { addToast } = useToastStore();
  const { session, clearSession } = useOperatorSessionStore();
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null);
  const [hasNativeDetection, setHasNativeDetection] = useState(false);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [manualHash, setManualHash] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<{ detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]> } | null>(null);
  const isResetting = useRef(false);
  const statusRef = useRef<ScanStatus>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (detector) {
      detectorRef.current = new detector({ formats: ['qr_code'] });
      setHasNativeDetection(true);
    }
  }, []);

  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraAllowed(true);
      setStatus('scanning');
    } catch {
      setCameraAllowed(false);
    }
  }, []);

  useEffect(() => {
    requestCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [requestCamera]);

  const scheduleReset = useCallback(() => {
    scanTimeoutRef.current = setTimeout(() => {
      setStatus('scanning');
      setScannedCode('');
      setFeedback(null);
      setManualHash('');
      isResetting.current = false;
    }, 1200);
  }, []);

  const validateTicket = useCallback(async (rawCode: string) => {
    if (!rawCode.trim() || isResetting.current || !session) return;
    isResetting.current = true;

    const response = await fetch('/api/operator/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operatorKey: session.operatorKey,
        code: rawCode.trim(),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error || 'Scan validation failed';
      if (/operator key/i.test(message)) {
        clearSession();
      }
      setStatus('invalid');
      setScannedCode(rawCode.trim().toUpperCase());
      setFeedback({
        message: /operator key/i.test(message)
          ? 'Operator session expired. Re-enter the event key.'
          : message,
      });
      addToast({
        type: 'error',
        title: /operator key/i.test(message) ? 'Scanner Session Lost' : 'Scan Failed',
        message,
      });
      scheduleReset();
      return;
    }

    const newStatus = (payload.scan_status || 'invalid') as ScanStatus;
    const displayCode = String(payload.ticket_hash || rawCode).trim().toUpperCase();

    setStatus(newStatus);
    setScannedCode(displayCode);
    setFeedback({
      attendeeName: payload.attendee_name,
      attendeeEmail: payload.attendee_email,
      message: payload.message,
    });

    if (newStatus === 'valid' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    } else if (newStatus === 'invalid' && navigator.vibrate) {
      navigator.vibrate([300]);
    } else if (newStatus === 'already_scanned' && navigator.vibrate) {
      navigator.vibrate([120, 40, 120, 40, 120]);
    }

    onScanComplete?.();
    scheduleReset();
  }, [addToast, clearSession, onScanComplete, scheduleReset, session]);

  const decodeWithJsQr = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const result = jsQR(image.data, image.width, image.height, {
      inversionAttempts: 'attemptBoth',
    });

    return result?.data || null;
  }, []);

  useEffect(() => {
    if (!cameraAllowed) return;

    let active = true;
    const tick = async () => {
      if (!active || !videoRef.current) return;

      if (statusRef.current === 'scanning' && !isResetting.current) {
        try {
          let value: string | null = null;

          const detector = detectorRef.current;
          if (detector) {
            const detected = await detector.detect(videoRef.current);
            value = detected[0]?.rawValue || null;
          }

          if (!value) {
            value = decodeWithJsQr();
          }

          if (value) {
            await validateTicket(value);
          }
        } catch {
          const fallbackValue = decodeWithJsQr();
          if (fallbackValue) {
            await validateTicket(fallbackValue);
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraAllowed, decodeWithJsQr, validateTicket]);

  const overlayConfig = {
    idle: null,
    scanning: null,
    valid: { bg: 'rgba(16,185,129,0.92)', icon: <CheckCircle2 size={72} className="text-white" />, label: 'ACCESS GRANTED' },
    invalid: { bg: 'rgba(239,68,68,0.92)', icon: <XCircle size={72} className="text-white" />, label: 'ACCESS DENIED' },
    already_scanned: { bg: 'rgba(251,191,36,0.9)', icon: <XCircle size={72} className="text-white" />, label: 'ALREADY SCANNED' },
  };

  const overlay = overlayConfig[status];

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '100vh', background: '#000' }}>
      {cameraAllowed === false ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <CameraOff size={36} className="text-red-400" />
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-lg mb-1" style={{ letterSpacing: '-0.02em' }}>Camera Access Denied</h3>
            <p className="text-white/40 text-sm">Enter the ticket hash manually for this event.</p>
          </div>

          <div className="w-full max-w-sm">
            <div
              className="flex gap-2 p-1 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center pl-3">
                <Hash size={15} className="text-white/40" />
              </div>
              <input
                value={manualHash}
                onChange={(e) => setManualHash(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && void validateTicket(manualHash)}
                placeholder="Enter Hash (e.g. SPH-AB12-CD34-EF56)"
                className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none py-3 font-mono"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => void validateTicket(manualHash)}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
              >
                Validate
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {scannedCode && overlay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-sm p-4 rounded-xl flex items-center gap-3"
                style={{
                  background: status === 'valid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${status === 'valid' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}
              >
                {overlay.icon && <div className="scale-50 -m-3">{overlay.icon}</div>}
                <div>
                  <p className="text-white font-bold text-sm">{overlay.label}</p>
                  <p className="text-white/40 text-xs font-mono">{scannedCode}</p>
                  {feedback?.message && <p className="text-white/35 text-xs mt-1">{feedback.message}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ position: 'absolute', inset: 0 }}
            muted
            playsInline
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="mb-6 text-center">
              <h3 className="text-white font-bold text-xl tracking-tight drop-shadow-lg">QR Scanner</h3>
              <p className="text-white/60 text-sm mt-1 drop-shadow">
                Point camera at the QR code for {session?.eventTitle || 'this event'}
              </p>
            </div>

            <div className="relative" style={{ width: 240, height: 240 }}>
              <div className="absolute inset-0 rounded-2xl" style={{ border: '2px solid rgba(255,255,255,0.3)' }} />
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute w-8 h-8 ${pos}`}
                  style={{
                    borderTop: i < 2 ? '3px solid #0ea5e9' : 'none',
                    borderBottom: i >= 2 ? '3px solid #0ea5e9' : 'none',
                    borderLeft: i % 2 === 0 ? '3px solid #0ea5e9' : 'none',
                    borderRight: i % 2 === 1 ? '3px solid #0ea5e9' : 'none',
                    borderRadius: i === 0 ? '12px 0 0 0' : i === 1 ? '0 12px 0 0' : i === 2 ? '0 0 0 12px' : '0 0 12px 0',
                  }}
                />
              ))}
              {status === 'scanning' && (
                <motion.div
                  animate={{ y: [0, 200, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-2 right-2 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, #0ea5e9, transparent)', top: 8 }}
                />
              )}
            </div>

            <div className="mt-8 rounded-2xl px-4 py-3 text-center" style={{ background: 'rgba(5,5,5,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/55 text-xs">
                {hasNativeDetection
                  ? 'QR auto-detection is active. A frame-based fallback also runs to catch camera scans that the browser misses.'
                  : 'Native QR detection is unavailable here, so the scanner is using a frame-based fallback plus manual entry.'}
              </p>
            </div>

            <div className="mt-5 w-full max-w-sm px-4">
              <div
                className="flex gap-2 p-1 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex items-center pl-3">
                  <Hash size={15} className="text-white/40" />
                </div>
                <input
                  value={manualHash}
                  onChange={(e) => setManualHash(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && void validateTicket(manualHash)}
                  placeholder="Manual hash fallback"
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none py-3 font-mono"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void validateTicket(manualHash)}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
                >
                  Validate
                </motion.button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {overlay && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
                style={{ background: overlay.bg, backdropFilter: 'blur(4px)' }}
              >
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {overlay.icon}
                </motion.div>
                <p className="text-white font-black text-3xl tracking-widest">{overlay.label}</p>
                <p className="text-white/70 font-mono text-sm">{scannedCode}</p>
                {feedback?.attendeeName && (
                  <p className="text-white/85 text-sm">{feedback.attendeeName}</p>
                )}
                {feedback?.message && (
                  <p className="text-white/70 text-xs">{feedback.message}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
