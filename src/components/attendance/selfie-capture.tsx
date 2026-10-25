"use client";
import { AlertTriangle, Camera, Eye, Loader2, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export type SelfieResult = {
  selfie: { base64: string; mimeType: "image/jpeg"; capturedAt: string };
  faceCheck: { faces: number; liveness: { passed: boolean; method: "blink" | "none"; score?: number }; detector: "mediapipe" | "none" };
};
type Landmarker = { detectForVideo: (video: HTMLVideoElement, ts: number) => { faceLandmarks: unknown[]; faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] }; close: () => void };

let landmarkerPromise: Promise<Landmarker> | null = null;
/** Face landmarks run entirely in the browser; frames never leave the device until the chosen photo is uploaded. */
function loadLandmarker() {
  landmarkerPromise ||= (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
    return await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" },
      runningMode: "VIDEO", numFaces: 3, outputFaceBlendshapes: true,
    }) as unknown as Landmarker;
  })().catch((error) => { landmarkerPromise = null; throw error; });
  return landmarkerPromise;
}

const BLINK_CLOSED = 0.55, BLINK_OPEN = 0.25;

/**
 * Live front-camera selfie with on-device checks: exactly one face and a blink (liveness) before the photo is taken.
 * Gallery uploads are not possible. If the face model can't load, a manual photo is allowed and flagged for review.
 */
export function SelfieCapture({ livenessRequired, onDone, onCancel }: { livenessRequired: boolean; onDone: (result: SelfieResult) => void; onCancel: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const blink = useRef<"open" | "closed" | "done">("open");
  const [phase, setPhase] = useState<"starting" | "detecting" | "fallback" | "error">("starting");
  const [faces, setFaces] = useState(0);
  const [blinked, setBlinked] = useState(false);
  const [error, setError] = useState("");
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const livenessRef = useRef(livenessRequired);
  const cancel = useCallback(() => onCancel(), [onCancel]);
  useDialogFocus(true, cancel, ref);

  const snapshot = useCallback((faceCount: number, detector: "mediapipe" | "none", passed: boolean) => {
    const element = video.current;
    if (!element || done.current) return;
    done.current = true;
    const scale = Math.min(1, 720 / Math.max(element.videoWidth, element.videoHeight));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(element.videoWidth * scale), height: Math.round(element.videoHeight * scale) });
    const context = canvas.getContext("2d")!;
    context.translate(canvas.width, 0); context.scale(-1, 1); // store what the user saw (mirrored preview)
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    onDoneRef.current({
      selfie: { base64: canvas.toDataURL("image/jpeg", 0.82).split(",")[1], mimeType: "image/jpeg", capturedAt: new Date().toISOString() },
      faceCheck: { faces: faceCount, liveness: { passed, method: detector === "mediapipe" && livenessRef.current ? "blink" : "none" }, detector },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) return;
        video.current!.srcObject = stream.current;
        await video.current!.play();
      } catch (reason) {
        const denied = reason instanceof DOMException && (reason.name === "NotAllowedError" || reason.name === "SecurityError");
        setError(denied ? "Camera access is blocked. Allow the camera for this site in your browser settings, then try again." : "We couldn't start your camera. Check that no other app is using it.");
        setPhase("error"); return;
      }
      let landmarker: Landmarker;
      try { landmarker = await loadLandmarker(); } catch { if (!cancelled) setPhase("fallback"); return; }
      if (cancelled) return;
      setPhase("detecting");
      let stableSince = 0;
      const loop = () => {
        if (cancelled || done.current || !video.current) return;
        if (video.current.readyState >= 2) {
          const result = landmarker.detectForVideo(video.current, performance.now());
          const count = result.faceLandmarks.length;
          setFaces(count);
          if (count === 1) {
            const scores = result.faceBlendshapes?.[0]?.categories || [];
            const eyes = ((scores.find((c) => c.categoryName === "eyeBlinkLeft")?.score || 0) + (scores.find((c) => c.categoryName === "eyeBlinkRight")?.score || 0)) / 2;
            if (blink.current === "open" && eyes > BLINK_CLOSED) blink.current = "closed";
            else if (blink.current === "closed" && eyes < BLINK_OPEN) { blink.current = "done"; setBlinked(true); }
            stableSince ||= performance.now();
            // Take the photo with eyes open, once liveness passed (or after a steady second when liveness is off).
            if ((livenessRef.current ? blink.current === "done" : performance.now() - stableSince > 1000) && eyes < BLINK_OPEN) { snapshot(1, "mediapipe", true); return; }
          } else stableSince = 0;
        }
        frame.current = requestAnimationFrame(loop);
      };
      loop();
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [snapshot]);

  const hint = phase === "starting" ? "Starting camera…"
    : phase === "fallback" ? "Face check unavailable on this device — your manager will verify the photo."
    : faces === 0 ? "Centre your face in the frame" : faces > 1 ? "Only you should be in the photo" : livenessRequired && !blinked ? "Now blink once" : "Hold still…";

  return (
    <>
      <button className="flow-backdrop" aria-label="Cancel selfie" onClick={cancel} />
      <section className="flow-dialog selfie-dialog" role="dialog" aria-modal="true" aria-labelledby="selfie-title" ref={ref} tabIndex={-1}>
        <button className="flow-close" aria-label="Cancel" onClick={cancel}><X size={18} /></button>
        <p className="cw-eyebrow" style={{ color: "var(--teal)" }}>ATTENDANCE · VERIFY IT’S YOU</p>
        <h2 id="selfie-title">Take a quick selfie</h2>
        {phase === "error" ? <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p> : (
          <div className={`selfie-frame ${faces === 1 ? "ok" : faces > 1 ? "bad" : ""}`}>
            <video ref={video} playsInline muted aria-label="Front camera preview" />
            <span className="selfie-oval" aria-hidden />
            <p className="selfie-hint" aria-live="polite">{phase === "starting" ? <Loader2 size={15} className="spin" /> : faces === 1 && livenessRequired && !blinked ? <Eye size={15} /> : <Camera size={15} />} {hint}</p>
          </div>
        )}
        <p className="selfie-privacy"><ShieldCheck size={14} /> Face checks run on this device. Only the photo is saved with your punch, visible to you, your manager and HR, and deleted automatically after the retention period.</p>
        <div className="cw-action-row">
          <button className="cw-btn ghost" onClick={cancel}>Cancel</button>
          {phase === "fallback" && <button className="cw-btn primary" style={{ ["--accent" as string]: "#0b615c" }} onClick={() => snapshot(0, "none", false)}><Camera size={15} /> Take photo</button>}
        </div>
      </section>
    </>
  );
}

/** Imperative helper: `await request(livenessRequired)` opens the camera and resolves with the photo, or null if cancelled. */
export function useSelfieCapture() {
  const [pending, setPending] = useState<{ liveness: boolean; resolve: (value: SelfieResult | null) => void } | null>(null);
  const request = useCallback((liveness: boolean) => new Promise<SelfieResult | null>((resolve) => setPending({ liveness, resolve })), []);
  const element = pending ? (
    <SelfieCapture livenessRequired={pending.liveness}
      onDone={(result) => { pending.resolve(result); setPending(null); }}
      onCancel={() => { pending.resolve(null); setPending(null); }} />
  ) : null;
  return { request, element };
}
