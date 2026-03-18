import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CopyProgress {
  status: "idle" | "loading" | "success" | "error";
  copied: number;
  total: number;
  error?: string;
}

export function useCopyTenantData() {
  const [progress, setProgress] = useState<CopyProgress>({
    status: "idle",
    copied: 0,
    total: 0,
  });

  const copyData = async (
    sourceTenantId: string,
    targetTenantId: string,
    dataType: "songs" | "events",
    itemIds: string[]
  ) => {
    setProgress({
      status: "loading",
      copied: 0,
      total: itemIds.length,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/copy-tenant-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sourceTenantId,
            targetTenantId,
            dataType,
            itemIds,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha ao copiar dados");
      }

      const result = await response.json();

      setProgress({
        status: "success",
        copied: result.copied,
        total: itemIds.length,
      });

      toast.success(`${result.copied} itens copiados com sucesso!`);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || "Erro ao copiar dados";
      setProgress({
        status: "error",
        copied: 0,
        total: itemIds.length,
        error: errorMessage,
      });
      toast.error(errorMessage);
      throw error;
    }
  };

  const reset = () => {
    setProgress({ status: "idle", copied: 0, total: 0 });
  };

  return { copyData, progress, reset };
}
