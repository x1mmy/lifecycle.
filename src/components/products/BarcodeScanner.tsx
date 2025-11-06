  "use client";

  import { useEffect, useRef, useState } from "react";
  import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
  import { Camera, X, Flashlight, FlashlightOff } from "lucide-react";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from "~/components/ui/dialog";
  import { Button } from "~/components/ui/button";

  interface BarcodeScannerProps {
    open: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
  }

  export const BarcodeScanner = ({ open, onClose, onScan }: BarcodeScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

    // NEW: Visual feedback states for better UX
    const [barcodeDetected, setBarcodeDetected] = useState(false); // Shows "barcode detected, focusing..." message
    const [isProcessing, setIsProcessing] = useState(false); // Shows when actually reading/validating barcode
    const [focusIndicator, setFocusIndicator] = useState(false); // Shows tap-to-focus animation

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const videoElementRef = useRef<HTMLVideoElement | null>(null); // NEW: Reference to video element for tap-to-focus
    const videoTrackRef = useRef<MediaStreamTrack | null>(null); // NEW: Reference to video track for focus control
    const scannerDivId = "barcode-scanner-reader";

    // Barcode validation function
    const validateBarcode = (barcode: string): { isValid: boolean; type: string } => {
      // Remove any whitespace
      const code = barcode.trim();

      // EAN-13 validation (13 digits)
      if (code.length === 13 && /^\d+$/.test(code)) {
        const checksum = parseInt(code.charAt(12));
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(code.charAt(i)) * (i % 2 === 0 ? 1 : 3);
        }
        const calculatedChecksum = (10 - (sum % 10)) % 10;
        if (checksum === calculatedChecksum) {
          return { isValid: true, type: "EAN-13" };
        }
      }

      // UPC-A validation (12 digits)
      if (code.length === 12 && /^\d+$/.test(code)) {
        const checksum = parseInt(code.charAt(11));
        let sum = 0;
        for (let i = 0; i < 11; i++) {
          sum += parseInt(code.charAt(i)) * (i % 2 === 0 ? 3 : 1);
        }
        const calculatedChecksum = (10 - (sum % 10)) % 10;
        if (checksum === calculatedChecksum) {
          return { isValid: true, type: "UPC-A" };
        }
      }

      // EAN-8 validation (8 digits)
      if (code.length === 8 && /^\d+$/.test(code)) {
        const checksum = parseInt(code.charAt(7));
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          sum += parseInt(code.charAt(i)) * (i % 2 === 0 ? 3 : 1);
        }
        const calculatedChecksum = (10 - (sum % 10)) % 10;
        if (checksum === calculatedChecksum) {
          return { isValid: true, type: "EAN-8" };
        }
      }

      // Accept other formats without validation
      if (code.length >= 6) {
        return { isValid: true, type: "OTHER" };
      }

      return { isValid: false, type: "INVALID" };
    };

    // IMPROVED: Tap-to-focus handler with better mobile device support
    const handleTapToFocus = async () => {
      // Only allow tap-to-focus when scanner is running
      if (!isScanning || !videoTrackRef.current) return;

      // Always show visual feedback so user knows they tapped
      setFocusIndicator(true);
      setTimeout(() => setFocusIndicator(false), 800); // Hide after animation

      try {
        const capabilities = videoTrackRef.current.getCapabilities();
        console.log('📸 Attempting focus with capabilities:', capabilities);

        // Try multiple focus strategies for better device compatibility

        // Strategy 1: Try setting focusMode to 'continuous'
        try {
          await videoTrackRef.current.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          });
          console.log('✅ Focus strategy 1 (continuous) succeeded');
          return;
        } catch {
          console.log('ℹ️ Focus strategy 1 failed, trying next...');
        }

        // Strategy 2: Try setting focusMode to 'single-shot' (works on some devices)
        try {
          await videoTrackRef.current.applyConstraints({
            advanced: [{ focusMode: 'single-shot' } as unknown as MediaTrackConstraintSet],
          });
          console.log('✅ Focus strategy 2 (single-shot) succeeded');
          return;
        } catch {
          console.log('ℹ️ Focus strategy 2 failed, trying next...');
        }

        // Strategy 3: Try toggling focus mode (sometimes this triggers refocus)
        try {
          await videoTrackRef.current.applyConstraints({
            advanced: [{ focusMode: 'manual' } as unknown as MediaTrackConstraintSet],
          });
          // Quickly switch back to continuous
          await videoTrackRef.current.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          });
          console.log('✅ Focus strategy 3 (toggle) succeeded');
          return;
        } catch {
          console.log('ℹ️ Focus strategy 3 failed');
        }

        // If all strategies fail, at least the visual feedback was shown
        console.log('ℹ️ Manual focus not supported on this device (visual feedback only)');
      } catch (err) {
        console.error('Tap-to-focus error:', err);
        // Visual feedback was already shown, so fail gracefully
      }
    };

    useEffect(() => {
      if (!open) {
        setShowInstructions(true); // Reset instructions when dialog closes
        setLastScannedCode(null); // Reset last scanned code
        setError(null); // Reset error
        setBarcodeDetected(false); // NEW: Reset barcode detection state
        setIsProcessing(false); // NEW: Reset processing state
        return;
      }

      let scanner: Html5Qrcode | null = null;
      const isAborted = false; // Track if initialization should be aborted

      const initScanner = async () => {
        try {
          setError(null);
          setLastScannedCode(null);
          setIsScanning(true);
          setShowInstructions(true);

          // Auto-hide instructions after 5 seconds
          setTimeout(() => {
            setShowInstructions(false);
          }, 5000);

          // Wait for DOM to be ready and dialog animation to complete
          // (fix for "element not found" error)
          // Increased delay to ensure element is rendered
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check if element exists before initializing
          const element = document.getElementById(scannerDivId);
          if (!element) {
            throw new Error("Scanner container not found in DOM");
          }

          // Create scanner instance
          scanner = new Html5Qrcode(scannerDivId, {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
          });

          scannerRef.current = scanner;

          // Request camera permissions and start scanning
          // Get specific camera for better mobile performance
          const cameras = await Html5Qrcode.getCameras();
          console.log("Available cameras:", cameras);

          if (cameras.length === 0) {
            throw new Error("No cameras found on this device");
          }

          // Use back camera on mobile (usually last camera)
          const cameraId = cameras.length > 1 ? cameras[cameras.length - 1]!.id : cameras[0]!.id;
          console.log("Using camera:", cameraId);

          // Wait for camera to fully stabilize and focus
          await new Promise(resolve => setTimeout(resolve, 1000));

          await scanner.start(
            cameraId, // Use specific camera ID instead of facingMode
            {
              fps: 10, // REDUCED FPS for better focus and accuracy
              qrbox: function(viewfinderWidth, viewfinderHeight) {
                // LARGER scan box for better barcode capture
                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                const calculatedSize = Math.floor(minEdgeSize * 0.75); // Increased from 0.6 to 0.75
                // Ensure minimum size of 50px (library requirement)
                const qrboxSize = Math.max(calculatedSize, 50);
                return {
                  width: qrboxSize,
                  height: qrboxSize,
                };
              },
              aspectRatio: 1.777778, // 16:9 ratio better for mobile cameras
              disableFlip: false,
              videoConstraints: {
                width: { ideal: 1920 }, // Request higher resolution for better barcode detection
                height: { ideal: 1080 },
                facingMode: "environment",
              },
            },
            (decodedText) => {
              // Success callback - barcode scanned!
              console.log("Barcode scanned (raw):", decodedText);

              // NEW: Show visual feedback that barcode was detected
              setBarcodeDetected(true);
              setIsProcessing(true);

              // Validate the barcode before accepting
              const validation = validateBarcode(decodedText);
              console.log("Validation result:", validation);

              if (validation.isValid) {
                console.log(`✅ Valid ${validation.type} barcode accepted`);
                setLastScannedCode(decodedText);

                // FIX: Add delay so user can see the "Barcode detected!" message
                // This gives visual feedback before closing the dialog
                setTimeout(() => {
                  onScan(decodedText);
                  void stopScanner();
                  onClose();
                }, 1200); // 1.2 second delay to show green indicator
              } else {
                console.warn("❌ Invalid barcode rejected:", decodedText);
                setLastScannedCode(decodedText);
                setError(`Invalid barcode: ${decodedText}. Please try again.`);
                // Keep scanner running so user can try again
                setBarcodeDetected(false);
                setIsProcessing(false);
              }
            },
            (errorMessage) => {
              // Error callback (called frequently, ignore most errors)
              // Only log actual errors, not "No barcode found" messages
              if (!errorMessage.includes("No MultiFormat Readers")) {
                // Silently ignore scanning errors
              }
            }
          );

          // NEW: Get video element and video track for advanced camera controls
          const videoElement = document.getElementById(scannerDivId)?.querySelector('video');
          if (videoElement?.srcObject) {
            videoElementRef.current = videoElement;
            const stream = videoElement.srcObject as MediaStream;
            const videoTrack = stream.getVideoTracks()[0];

            if (videoTrack) {
              videoTrackRef.current = videoTrack;
              console.log('📹 Video track acquired for advanced controls');

              // NEW: Apply continuous autofocus for better barcode scanning
              try {
                const trackCapabilities = videoTrack.getCapabilities();
                const trackSettings = videoTrack.getSettings();
                console.log('📸 Camera capabilities:', trackCapabilities);
                console.log('📸 Camera settings:', trackSettings);

                // IMPROVED: Apply autofocus with multiple strategies for better iOS/iPhone compatibility
                // Try multiple autofocus strategies (iOS is picky about focus modes)

                // Strategy 1: Try continuous focus (best for barcode scanning)
                try {
                  await videoTrack.applyConstraints({
                    advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
                  });
                  console.log('✅ Continuous autofocus enabled (strategy 1)');
                } catch {
                  // Strategy 2: Try without 'advanced' wrapper (works on some iOS versions)
                  try {
                    await videoTrack.applyConstraints({
                      focusMode: 'continuous',
                    } as unknown as MediaTrackConstraints);
                    console.log('✅ Continuous autofocus enabled (strategy 2)');
                  } catch {
                    // Strategy 3: Try applying focus distance constraint (iOS alternative)
                    try {
                      await videoTrack.applyConstraints({
                        advanced: [{ focusDistance: 0 } as unknown as MediaTrackConstraintSet],
                      });
                      console.log('✅ Focus distance set (strategy 3 - iOS fallback)');
                    } catch {
                      console.log('ℹ️ Manual autofocus not supported, using device default');
                    }
                  }
                }

                // IMPROVED: Better torch detection for various devices (especially Samsung)
                // Check multiple ways to detect torch support
                const hasTorchCapability = 'torch' in trackCapabilities;
                const hasTorchInSettings = 'torch' in trackSettings;

                // Some devices (like Samsung) might not report torch in capabilities
                // but still support it, so we'll try to enable it anyway
                if (hasTorchCapability || hasTorchInSettings) {
                  setTorchAvailable(true);
                  console.log('🔦 Torch/flashlight available (detected in capabilities/settings)');
                } else {
                  // Try to test if torch works by attempting to enable it
                  console.log('🔦 Torch not in capabilities, testing if it works anyway...');
                  try {
                    // Test if torch constraint can be applied
                    await videoTrack.applyConstraints({
                      advanced: [{ torch: true } as unknown as MediaTrackConstraintSet],
                    });
                    // If successful, torch is available! Turn it back off
                    await videoTrack.applyConstraints({
                      advanced: [{ torch: false } as unknown as MediaTrackConstraintSet],
                    });
                    setTorchAvailable(true);
                    console.log('🔦 Torch/flashlight available (detected via test)');
                  } catch {
                    console.log('🔦 Torch not supported on this device');
                    setTorchAvailable(false);
                  }
                }
              } catch (focusErr) {
                console.warn('Could not apply autofocus:', focusErr);
                // Continue anyway - not all devices support this
              }
            }
          }

          setIsScanning(true);
        } catch (err) {
          console.error("Error starting scanner:", err);

          if (err instanceof Error) {
            if (err.message.includes("NotAllowedError") || err.message.includes("Permission denied")) {
              setError("Camera permission denied. Please allow camera access in your browser settings.");
            } else if (err.message.includes("NotFoundError") || err.message.includes("not found")) {
              setError("No camera found on this device.");
            } else if (err.message.includes("NotReadableError")) {
              setError("Camera is in use by another application. Please close other apps and try again.");
            } else if (err.message.includes("DOM")) {
              // Scanner container not found - this should be rare now with the delay
              setError("Failed to initialize scanner. Please close and try again.");
            } else {
              // Show the actual error message for debugging
              setError(`Failed to start camera: ${err.message}`);
            }
          } else {
            setError("Failed to start camera. Please try again.");
          }

          setIsScanning(false);
        }
      };

      const stopScanner = async () => {
        if (scannerRef.current) {
          try {
            // Check if scanner is running using the built-in property
            const isRunning = scannerRef.current.isScanning;
            console.log("Scanner is running:", isRunning);

            // Only stop if scanner is actively scanning
            if (isRunning) {
              await scannerRef.current.stop();
              console.log("Scanner stopped successfully");
            }

            // Clear the scanner (synchronous operation)
            scannerRef.current.clear();
            console.log("Scanner cleared");
          } catch (err) {
            console.error("Error stopping scanner:", err);
            // Force clear even if stop fails
            try {
              scannerRef.current.clear();
            } catch (clearErr) {
              console.error("Error clearing scanner:", clearErr);
            }
          }
          scannerRef.current = null;
        }
        setIsScanning(false);
        setTorchEnabled(false);
      };

      void initScanner();

      // Cleanup on unmount or when dialog closes
      return () => {
        void stopScanner();
      };
    }, [open, onScan, onClose]);

    // NEW: Improved torch toggle using direct video track control
    const toggleTorch = async () => {
      // Use video track reference for more reliable torch control
      if (!videoTrackRef.current || !torchAvailable) return;

      try {
        const newTorchState = !torchEnabled;

        // Apply torch constraint directly to video track
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newTorchState } as unknown as MediaTrackConstraintSet],
        });

        setTorchEnabled(newTorchState);
        console.log(`🔦 Torch ${newTorchState ? 'ON' : 'OFF'}`);
      } catch (err) {
        console.error("Error toggling torch:", err);
        setError("Failed to toggle flashlight. This feature may not be supported on your device.");
      }
    };

    const handleClose = () => {
      onClose();
    };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Barcode
            </DialogTitle>
            <DialogDescription>
              Position the barcode within the frame to scan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Scanner Container */}
            <div className="relative overflow-hidden rounded-lg bg-black">
              {/* NEW: Tap-to-focus wrapper - clicking triggers manual focus */}
              <div
                id={scannerDivId}
                className="w-full cursor-pointer"
                onClick={handleTapToFocus}
                title="Tap to focus"
              />

              {/* Loading Overlay */}
              {!isScanning && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                    <p className="text-sm">Initializing camera...</p>
                  </div>
                </div>
              )}

              {/* NEW: Focus indicator animation - shows when user taps to focus */}
              {focusIndicator && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-24 w-24 rounded-full border-4 border-blue-400 animate-ping" />
                  <div className="absolute h-16 w-16 rounded-full border-4 border-blue-500" />
                </div>
              )}

              {/* NEW: Barcode detected indicator - shows when barcode is found and being processed */}
              {barcodeDetected && isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-lg bg-green-500/90 px-6 py-4 backdrop-blur-sm animate-pulse">
                    <p className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="text-2xl">✓</span>
                      Barcode detected!
                    </p>
                    <p className="text-sm text-white/90 text-center mt-1">
                      Hold still, reading...
                    </p>
                  </div>
                </div>
              )}

              {/* Scan Guide Overlay - Dismissible */}
              {isScanning && !error && showInstructions && !barcodeDetected && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  onClick={() => setShowInstructions(false)}
                >
                  <div className="mt-4 rounded-lg bg-black/70 px-4 py-3 backdrop-blur-sm cursor-pointer hover:bg-black/80 transition-colors">
                    <p className="text-sm font-medium text-white">
                      📷 Position barcode in frame
                    </p>
                    <p className="text-xs text-white/80 mb-1">
                      Camera will auto-focus and scan
                    </p>
                    <p className="text-xs text-white/70 mb-1">
                      💡 Tap video to manually focus
                    </p>
                    <p className="text-xs text-white/60 text-center">
                      (Tap to dismiss)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Last Scanned Code Display */}
            {lastScannedCode && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
                <p className="font-semibold text-blue-900">Last scan detected:</p>
                <p className="mt-1 font-mono text-blue-700 text-lg">{lastScannedCode}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-semibold">Scanner Message</p>
                <p className="mt-1">{error}</p>
                {lastScannedCode && (
                  <p className="mt-2 text-xs">
                    Try holding the barcode steadier and ensure good lighting.
                  </p>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {torchAvailable && isScanning && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleTorch}
                  className="flex-1"
                >
                  {torchEnabled ? (
                    <>
                      <FlashlightOff className="mr-2 h-4 w-4" />
                      Flashlight Off
                    </>
                  ) : (
                    <>
                      <Flashlight className="mr-2 h-4 w-4" />
                      Flashlight On
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className={torchAvailable ? "flex-1" : "w-full"}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>

            {/* Help Text */}
            <div className="space-y-1 text-center text-xs text-muted-foreground">
              <p>Supports EAN-13, UPC, Code 128, and QR codes</p>
              <p className="font-medium">📱 Mobile tip: Hold phone steady, barcode should be 4-6 inches away</p>
              <p className="text-blue-600 dark:text-blue-400">💡 Tap the video to manually focus if needed</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
