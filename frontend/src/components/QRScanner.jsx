import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const containerId = "qr-reader-container";

  useEffect(() => {
    let isMounted = true;
    
    const startScanner = async () => {
      try {
        // Wait for the DOM element to be available
        if (!document.getElementById(containerId)) {
          console.warn("Scanner container not found");
          return;
        }

        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          throw new Error("No camera found");
        }

        const cameraId = devices[0].id;
        
        // Create instance
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              onScan(decodedText);
            }
          },
          (errorMessage) => {
            // ignore errors
          }
        );

        if (isMounted) {
          setIsScanning(true);
        } else {
          // If unmounted during start, stop immediately
          if (scanner.isScanning) {
            await scanner.stop();
          }
          scanner.clear();
        }
      } catch (err) {
        console.error("Scanner error:", err);
        if (isMounted) {
          // Only set error if it's not a "stop() called" error
          if (err?.name !== "Html5QrcodeError") {
             setError(err.message || "Failed to start camera");
          }
        }
      }
    };

    // Small timeout to ensure DOM is ready
    const timer = setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
            scannerRef.current.clear();
        }).catch(err => {
            console.warn("Failed to stop scanner", err);
        });
      }
    };
  }, [onScan]);

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-8 text-center">
        <p className="text-red-400 font-bold mb-2">Camera Error</p>
        <p className="text-red-300 text-sm">{error}</p>
        <p className="text-zinc-500 text-xs mt-4">Please ensure you have granted camera permissions.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative">
      <div id={containerId} className="w-full min-h-[300px] bg-black" />
      {!isScanning && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">Initializing Camera...</p>
          </div>
        </div>
      )}
      {isScanning && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-zinc-400 text-center text-xs font-bold uppercase tracking-widest pointer-events-none">
          Align QR code within the frame
        </div>
      )}
    </div>
  );
}
