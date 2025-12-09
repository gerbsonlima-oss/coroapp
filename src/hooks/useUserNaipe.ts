import { useState, useEffect } from 'react';

type Naipe = 'Soprano' | 'Contralto' | 'Tenor' | 'Baixo';

const STORAGE_KEY = 'user_naipe';

export const useUserNaipe = () => {
  const [naipe, setNaipeState] = useState<Naipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidNaipe(stored)) {
      setNaipeState(stored as Naipe);
    }
    setLoading(false);
  }, []);

  const setNaipe = (newNaipe: Naipe) => {
    localStorage.setItem(STORAGE_KEY, newNaipe);
    setNaipeState(newNaipe);
  };

  const clearNaipe = () => {
    localStorage.removeItem(STORAGE_KEY);
    setNaipeState(null);
  };

  return {
    naipe,
    setNaipe,
    clearNaipe,
    loading
  };
};

function isValidNaipe(value: string): boolean {
  return ['Soprano', 'Contralto', 'Tenor', 'Baixo'].includes(value);
}
