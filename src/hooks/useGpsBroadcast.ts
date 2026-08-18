import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MIN_INTERVAL_MS = 8000;

export type GpsState = {
  sharing: boolean;
  setSharing: (value: boolean) => void;
  status: "idle" | "locating" | "live" | "denied" | "error";
  error: string | null;
};

export function useGpsBroadcast(userId: string | undefined): GpsState {
  const [sharing, setSharing] = useState(true);
  const [status, setStatus] = useState<GpsState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    if (!sharing) {
      setStatus("idle");
      void supabase.from("locations").update({ sharing: false }).eq("user_id", userId);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError("This device doesn't support location.");
      return;
    }

    setStatus("locating");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setStatus("live");
        setError(null);
        const now = Date.now();
        if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
        lastSentRef.current = now;
        void supabase.from("locations").upsert(
          {
            user_id: userId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
            heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null,
            sharing: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      },
      (positionError) => {
        setStatus(positionError.code === positionError.PERMISSION_DENIED ? "denied" : "error");
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location permission is blocked. Enable it in Settings > Safari > Location."
            : positionError.message,
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, sharing]);

  return { sharing, setSharing, status, error };
}
