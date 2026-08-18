import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { Crosshair, LocateFixed, Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGpsBroadcast } from "@/hooks/useGpsBroadcast";
import { useGroupMembers, useGroups, useLocationRealtime } from "@/hooks/useLiveLocations";
import { GroupSheet } from "@/components/GroupSheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatSpeed, initials, isStale, timeAgo } from "@/lib/geo";

const LiveMap = lazy(() => import("@/components/LiveMap"));

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse bg-muted" />;
}

export function MapScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [focusUserId, setFocusUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: groups = [] } = useGroups(user?.id);
  const gps = useGpsBroadcast(user?.id);

  useEffect(() => {
    if (!activeGroupId && groups.length > 0) setActiveGroupId(groups[0]!.id);
  }, [groups, activeGroupId]);

  useLocationRealtime(activeGroupId);
  const { data: members = [] } = useGroupMembers(activeGroupId, user?.id);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const sorted = useMemo(
    () => [...members].sort((a, b) => Number(b.isSelf) - Number(a.isSelf)),
    [members],
  );

  if (!user) {
    return <div className="flex h-dvh items-center justify-center text-muted-foreground">…</div>;
  }

  const statusLabel =
    gps.status === "live"
      ? "Broadcasting"
      : gps.status === "locating"
        ? "Finding you…"
        : gps.status === "denied"
          ? "Location blocked"
          : gps.sharing
            ? "Waiting"
            : "Paused";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <LiveMap members={members} focusUserId={focusUserId} />
          </Suspense>
        </ClientOnly>
      </div>

      <header className="glass-panel absolute inset-x-3 top-3 z-[500] flex items-center gap-3 rounded-2xl px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base font-semibold">
            {activeGroup?.name ?? "No group yet"}
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio
              className={`size-3 ${gps.status === "live" ? "text-primary" : "text-muted-foreground"}`}
            />
            {statusLabel}
            {activeGroup ? ` · ${activeGroup.code}` : ""}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setGroupsOpen(true)}>
          <Users className="size-4" /> Groups
        </Button>
      </header>

      {gps.error ? (
        <div className="glass-panel absolute inset-x-3 top-24 z-[500] rounded-xl px-4 py-2 text-xs text-destructive">
          {gps.error}
        </div>
      ) : null}

      <section className="glass-panel absolute inset-x-0 bottom-0 z-[500] max-h-[46vh] overflow-y-auto rounded-t-3xl px-4 pb-6 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <LocateFixed className="size-4 text-primary" />
            <span className="font-medium">Share my location</span>
          </div>
          <Switch
            checked={gps.sharing}
            onCheckedChange={gps.setSharing}
            aria-label="Share my location"
          />
        </div>

        <ul className="space-y-2">
          {sorted.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {activeGroup
                ? "Nobody is sharing in this group yet. Send them the code above."
                : "Create or join a group to start sharing."}
            </li>
          ) : (
            sorted.map((member) => (
              <li key={member.user_id}>
                <button
                  type="button"
                  onClick={() => setFocusUserId(member.user_id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left transition-colors hover:bg-secondary"
                >
                  <span
                    className="map-pin shrink-0"
                    data-self={member.isSelf}
                    data-stale={isStale(member.updated_at)}
                  >
                    {initials(member.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {member.display_name}
                      {member.isSelf ? " (you)" : ""}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {timeAgo(member.updated_at)} · {formatSpeed(member.speed)}
                    </span>
                  </span>
                  <Crosshair className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))
          )}
        </ul>

        <Button
          variant="ghost"
          size="sm"
          className="mt-4 w-full text-muted-foreground"
          onClick={() => {
            void supabase.auth.signOut();
          }}
        >
          Sign out
        </Button>
      </section>

      <GroupSheet
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        groups={groups}
        activeGroupId={activeGroupId}
        onSelect={setActiveGroupId}
        userId={user.id}
      />
    </main>
  );
}
