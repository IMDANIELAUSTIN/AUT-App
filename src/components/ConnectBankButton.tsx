import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/openui/Button";
import { getSupabaseConfigError, isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useUserKey } from "@/lib/useUserKey";
import { toast } from "sonner";

export function ConnectBankButton({
  onConnected,
  size = "md",
  variant = "default",
  label = "Connect bank account",
}: {
  onConnected?: () => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost" | "subtle" | "destructive";
  label?: string;
}) {
  const userKey = useUserKey();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    if (!userKey) return;
    if (!isSupabaseConfigured) {
      toast.error("Bank connections are not configured", {
        description: getSupabaseConfigError(),
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("plaid-link-token", {
        body: { user_key: userKey },
      });
      if (error) throw error;
      if (!data?.link_token) throw new Error("No link token returned");
      setLinkToken(data.link_token);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start bank connection", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [userKey]);

  const onSuccess = useCallback(async (public_token: string, metadata: { institution?: { name: string } | null }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("plaid-exchange", {
        body: { user_key: userKey, public_token, institution: metadata.institution },
      });
      if (error) throw error;
      toast.success(`Connected ${data?.institution ?? "bank account"}`, {
        description: `${data?.accounts?.length ?? 0} account(s) linked. Syncing transactions…`,
      });
      // Trigger initial sync
      supabase.functions.invoke("plaid-transactions", {
        body: { user_key: userKey, sync: true },
      }).then(() => onConnected?.());
    } catch (e) {
      console.error(e);
      toast.error("Failed to link account", { description: String(e) });
    } finally {
      setLoading(false);
      setLinkToken(null);
    }
  }, [userKey, onConnected]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <Button
      size={size}
      variant={variant}
      onClick={fetchLinkToken}
      disabled={loading || !userKey || !isSupabaseConfigured}
      title={!isSupabaseConfigured ? getSupabaseConfigError() : undefined}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
      {label}
    </Button>
  );
}
