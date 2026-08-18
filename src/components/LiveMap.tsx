import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MemberLocation } from "@/lib/geo";
import { initials, isStale, timeAgo } from "@/lib/geo";

type Props = {
  members: MemberLocation[];
  focusUserId: string | null;
};

export default function LiveMap({ members, focusUserId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const didFitRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.5, -98.35],
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  const signature = useMemo(
    () => members.map((m) => `${m.user_id}:${m.lat}:${m.lng}:${m.updated_at}`).join("|"),
    [members],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const member of members) {
      seen.add(member.user_id);
      const stale = isStale(member.updated_at);
      const html = `<div class="relative"><div class="map-pin ${
        member.isSelf && !stale ? "pin-pulse" : ""
      }" data-self="${member.isSelf}" data-stale="${stale}">${initials(member.display_name)}</div></div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [34, 34], iconAnchor: [17, 17] });
      const existing = markersRef.current.get(member.user_id);
      const popup = `<strong>${member.display_name}${member.isSelf ? " (you)" : ""}</strong><br/>${timeAgo(
        member.updated_at,
      )}`;

      if (existing) {
        existing.setLatLng([member.lat, member.lng]);
        existing.setIcon(icon);
        existing.setPopupContent(popup);
      } else {
        const marker = L.marker([member.lat, member.lng], { icon }).addTo(map).bindPopup(popup);
        markersRef.current.set(member.user_id, marker);
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    if (!didFitRef.current && members.length > 0) {
      didFitRef.current = true;
      const bounds = L.latLngBounds(members.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusUserId) return;
    const target = members.find((m) => m.user_id === focusUserId);
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    markersRef.current.get(focusUserId)?.openPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusUserId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
