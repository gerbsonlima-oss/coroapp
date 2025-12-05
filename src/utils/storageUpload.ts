import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a file to a storage bucket and returns its public URL.
 * Uses a simple retry mechanism to make uploads more robust on mobile / slow networks.
 */
export const uploadFileToBucket = async (
  file: File,
  bucket: string,
  path: string,
  retries = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
      });

      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (error: any) {
      console.error(`Upload attempt ${attempt} failed:`, error);

      if (attempt === retries) {
        throw new Error(
          `Erro ao fazer upload de ${file.name}: ${error?.message || "Erro desconhecido"}`
        );
      }

      // Backoff simples antes de tentar novamente
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error("Upload falhou após múltiplas tentativas");
};
