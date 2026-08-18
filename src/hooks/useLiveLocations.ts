import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MemberLocation } from "@/lib/geo";

export type Group = { id: string; name: string; code: string; created_by: string };

export function useGroups(userId: string | undefined) {
  return useQuery({
    queryKey: ["groups", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select("groups(id, name, code, created_by)")
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as unknown as { groups: Group | null }).groups)
        .filter((g): g is Group => !!g);
    },
  });
}

export function useGroupMembers(groupId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ["members", groupId],
    enabled: !!groupId && !!userId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<MemberLocation[]> => {
      const { data: memberRows, error: memberError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId!);
      if (memberError) throw memberError;
      const ids = (memberRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];

      const [{ data: profiles, error: profileError }, { data: locations, error: locationError }] =
        await Promise.all([
          supabase.from("profiles").select("id, display_name").in("id", ids),
          supabase
            .from("locations")
            .select("user_id, lat, lng, accuracy, speed, updated_at")
            .in("user_id", ids),
        ]);
      if (profileError) throw profileError;
      if (locationError) throw locationError;

      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      return (locations ?? []).map((loc) => ({
        user_id: loc.user_id,
        display_name: nameById.get(loc.user_id) ?? "Member",
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        speed: loc.speed,
        updated_at: loc.updated_at,
        isSelf: loc.user_id === userId,
      }));
    },
  });
}

export function useLocationRealtime(groupId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`live-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["members", groupId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        queryClient.invalidateQueries({ queryKey: ["members", groupId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
