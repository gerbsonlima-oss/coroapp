import { InstallPWAButton } from "@/components/InstallPWAButton";
import { Music, Calendar, ListMusic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center max-w-md w-full space-y-8">
        <div className="space-y-4">
          <Music className="w-14 h-14 mx-auto text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Coro Quixadá</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestão de repertório de coral
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <InstallPWAButton 
            variant="default" 
            size="lg" 
            className="w-full"
            showText={true}
          />
          
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/songs")}
            className="w-full"
          >
            <ListMusic className="mr-2 h-5 w-5" />
            Ver Músicas
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/events")}
            className="w-full"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Ver Eventos
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Instale o app no seu celular para acesso offline
        </p>
      </div>
    </div>
  );
};

export default Index;
