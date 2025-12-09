import { ReactNode, useEffect, useState } from 'react';
import { NaipeSelectionDialog } from '@/components/NaipeSelectionDialog';
import { useUserNaipe } from '@/hooks/useUserNaipe';

type Naipe = 'Soprano' | 'Contralto' | 'Tenor' | 'Baixo';

interface AppWithNaipeSelectionProps {
  children: ReactNode;
}

export function AppWithNaipeSelection({ children }: AppWithNaipeSelectionProps) {
  const { naipe, setNaipe, loading } = useUserNaipe();
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!loading && !naipe) {
      setShowDialog(true);
    }
  }, [loading, naipe]);

  const handleNaipeSelected = (selectedNaipe: Naipe) => {
    setNaipe(selectedNaipe);
    setShowDialog(false);
  };

  return (
    <>
      <NaipeSelectionDialog
        open={showDialog}
        onNaipeSelected={handleNaipeSelected}
      />
      {children}
    </>
  );
}
