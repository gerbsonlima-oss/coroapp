import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Music } from 'lucide-react';

type Naipe = 'Soprano' | 'Contralto' | 'Tenor' | 'Baixo';

interface NaipeSelectionDialogProps {
  open: boolean;
  onNaipeSelected: (naipe: Naipe) => void;
}

const NAIPES: Naipe[] = ['Soprano', 'Contralto', 'Tenor', 'Baixo'];

export function NaipeSelectionDialog({
  open,
  onNaipeSelected
}: NaipeSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Bem-vindo ao Coro Diocesano de Quixadá
          </DialogTitle>
          <DialogDescription>
            Qual é o seu naipe?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {NAIPES.map((naipe) => (
            <Button
              key={naipe}
              onClick={() => onNaipeSelected(naipe)}
              className="h-20 text-base font-semibold"
              variant="outline"
            >
              {naipe}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
