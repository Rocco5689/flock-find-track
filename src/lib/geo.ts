export type MemberLocation = {
  user_id: string;
  display_name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  updated_at: string;
  isSelf: boolean;
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function isStale(iso: string) {
  return Date.now() - new Date(iso).getTime() > 5 * 60 * 1000;
}

export function formatSpeed(speed: number | null) {
  if (speed == null || Number.isNaN(speed) || speed < 0.3) return "stationary";
  return `${Math.round(speed * 2.23694)} mph`;
}
