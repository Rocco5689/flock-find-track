import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, LogOut, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Group } from "@/hooks/useLiveLocations";

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function GroupSheet({
  open,
  onOpenChange,
  groups,
  activeGroupId,
  onSelect,
  userId,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  groups: Group[];
  activeGroupId: string | null;
  onSelect: (id: string) => void;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["groups"] });

  async function createGroup() {
    if (!name.trim()) return;
    setBusy(true);
    const newCode = randomCode();
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), code: newCode, created_by: userId })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Could not create group");
      return;
    }
    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: data.id, user_id: userId });
    setBusy(false);
    if (joinError) {
      toast.error(joinError.message);
      return;
    }
    setName("");
    await refresh();
    onSelect(data.id);
    toast.success(`Group created — code ${newCode}`);
  }

  async function joinGroup() {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("join_group_by_code", { _code: code.trim() });
    setBusy(false);
    if (error) {
      toast.error("That group code didn't match anything.");
      return;
    }
    setCode("");
    await refresh();
    if (typeof data === "string") onSelect(data);
    toast.success("You joined the group");
  }

  async function leaveGroup(groupId: string) {
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Left the group");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">Groups</DialogTitle>
          <DialogDescription>
            Share a code so people can see each other on the map.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              You're not in a group yet. Create one, or join with a friend's code.
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  group.id === activeGroupId ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => {
                    onSelect(group.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="size-4 text-primary" />
                    {group.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-xs tracking-[0.2em] text-muted-foreground">
                    {group.code}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy group code"
                  onClick={() => {
                    void navigator.clipboard.writeText(group.code);
                    toast.success("Code copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Leave group"
                  onClick={() => void leaveGroup(group.id)}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="group-name">Create a group</Label>
          <div className="flex gap-2">
            <Input
              id="group-name"
              placeholder="Weekend crew"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button disabled={busy} onClick={() => void createGroup()}>
              <Plus className="size-4" /> Create
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-code">Join with a code</Label>
          <div className="flex gap-2">
            <Input
              id="group-code"
              placeholder="ABC123"
              value={code}
              maxLength={6}
              className="font-mono uppercase tracking-[0.3em]"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button variant="secondary" disabled={busy} onClick={() => void joinGroup()}>
              Join
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
