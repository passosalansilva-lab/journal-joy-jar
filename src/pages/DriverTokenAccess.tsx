import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Truck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function DriverTokenAccess() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Link de acesso inválido');
      return;
    }

    const authenticate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('driver-token-login', {
          body: { token },
        });

        if (error) {
          console.error('[DriverTokenAccess] Function error:', error);
          setStatus('error');
          setErrorMessage('Não foi possível autenticar. Tente novamente.');
          return;
        }

        if (data?.error) {
          setStatus('error');
          setErrorMessage(data.error);
          return;
        }

        if (data?.session) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (sessionError) {
            console.error('[DriverTokenAccess] setSession error:', sessionError);
            setStatus('error');
            setErrorMessage('Erro ao salvar sessão. Tente novamente.');
            return;
          }

          const firstName = data.driverName?.split(' ')[0];
          toast.success('Login realizado!', {
            description: firstName ? `Bem-vindo, ${firstName}!` : 'Bem-vindo!',
          });

          navigate('/driver', { replace: true });
          return;
        }

        setStatus('error');
        setErrorMessage('Resposta inesperada do servidor');
      } catch (err) {
        console.error('[DriverTokenAccess] Unexpected error:', err);
        setStatus('error');
        setErrorMessage('Erro inesperado. Tente novamente.');
      }
    };

    authenticate();
  }, [token, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Autenticando...</p>
            <p className="text-muted-foreground mt-2">Aguarde um momento</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Acesso não autorizado</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Este link pode estar expirado ou inválido. Peça um novo link ao estabelecimento.
          </p>
          <Button 
            onClick={() => navigate('/driver/login')} 
            className="w-full"
            variant="outline"
          >
            <Truck className="h-4 w-4 mr-2" />
            Ir para login manual
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
