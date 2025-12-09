import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface LiturgyContent {
  date: string;
  title: string;
  color: string;
  readings: string;
  body: string;
}

interface UseLiturgyReturn {
  data: LiturgyContent | null;
  loading: boolean;
  error: string | null;
}

export const useLiturgy = (date: Date): UseLiturgyReturn => {
  const [data, setData] = useState<LiturgyContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiturgy = async () => {
      setLoading(true);
      setError(null);

      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        const response = await fetch(
          `https://api-liturgia.edicoescnbb.com.br/contents/in/date/${dateStr}`,
          {
            headers: {
              accept: 'application/json',
              referer: 'https://liturgiadiaria.edicoescnbb.com.br/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Erro na API: ${response.status}`);
        }

        const apiData = await response.json();
        const content = apiData.content;

        if (!content) {
          throw new Error('Conteúdo não encontrado');
        }

        setData({
          date: content.date,
          title: content.title,
          color: content.color,
          readings: content.leituras || '',
          body: content.body || '',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLiturgy();
  }, [date]);

  return { data, loading, error };
};
