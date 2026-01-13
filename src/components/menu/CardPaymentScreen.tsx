import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Check, AlertCircle, CreditCard, Lock, Calendar, User, Hash, XCircle, ChevronDown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Extend window for MercadoPago SDK
declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface OrderItem {
  product_name: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
  options?: any[];
}

interface InstallmentOption {
  installments: number;
  installment_amount: number;
  total_amount: number;
  recommended_message?: string;
}

interface CardPaymentScreenProps {
  companyId: string;
  companyName: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddressId?: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  couponId?: string;
  discountAmount: number;
  notes?: string;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
  isModal?: boolean;
}

type PaymentStatus = 'loading' | 'form' | 'processing' | 'success' | 'error';

// Card brand detection
function detectCardBrand(cardNumber: string): { brand: string; icon: string } {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (/^4/.test(cleanNumber)) return { brand: 'visa', icon: '💳' };
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return { brand: 'master', icon: '💳' };
  if (/^3[47]/.test(cleanNumber)) return { brand: 'amex', icon: '💳' };
  if (/^6(?:011|5)/.test(cleanNumber)) return { brand: 'discover', icon: '💳' };
  if (/^(636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(cleanNumber)) return { brand: 'elo', icon: '💳' };
  if (/^(606282|3841)/.test(cleanNumber)) return { brand: 'hipercard', icon: '💳' };
  
  return { brand: 'unknown', icon: '💳' };
}

// Format card number with spaces
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// Format expiry date
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 2) {
    return digits.slice(0, 2) + '/' + digits.slice(2);
  }
  return digits;
}

// Format CPF
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Format currency
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Card brand logos mapping
const cardBrandColors: Record<string, string> = {
  visa: 'text-blue-600',
  master: 'text-orange-500',
  amex: 'text-blue-800',
  elo: 'text-yellow-500',
  hipercard: 'text-red-600',
  discover: 'text-orange-600',
  unknown: 'text-muted-foreground',
};

export function CardPaymentScreen({
  companyId,
  companyName,
  items,
  customerName,
  customerPhone,
  customerEmail,
  deliveryAddressId,
  deliveryFee,
  subtotal,
  total,
  couponId,
  discountAmount,
  notes,
  onSuccess,
  onCancel,
  isModal = false,
}: CardPaymentScreenProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const mpInstanceRef = useRef<any>(null);
  
  // Form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  
  const [cardBrandInfo, setCardBrandInfo] = useState({ brand: 'unknown', icon: '💳' });
  const [isFormValid, setIsFormValid] = useState(false);
  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState(12);

  // Load Mercado Pago SDK and get public key
  useEffect(() => {
    const loadMercadoPagoSDK = async () => {
      try {
        // Get public key and settings from backend
        const { data: keyData, error: keyError } = await supabase.functions.invoke('get-mercadopago-public-key', {
          body: { companyId },
        });

        if (keyError || !keyData?.publicKey) {
          throw new Error('Não foi possível configurar o pagamento');
        }

        setPublicKey(keyData.publicKey);
        if (keyData.maxInstallments) {
          setMaxInstallments(keyData.maxInstallments);
        }

        // Load SDK dynamically
        if (!window.MercadoPago) {
          const script = document.createElement('script');
          script.src = 'https://sdk.mercadopago.com/js/v2';
          script.async = true;
          script.onload = () => {
            mpInstanceRef.current = new (window as any).MercadoPago(keyData.publicKey, {
              locale: 'pt-BR',
            });
            setStatus('form');
          };
          script.onerror = () => {
            throw new Error('Erro ao carregar SDK de pagamento');
          };
          document.body.appendChild(script);
        } else {
          mpInstanceRef.current = new (window as any).MercadoPago(keyData.publicKey, {
            locale: 'pt-BR',
          });
          setStatus('form');
        }
      } catch (err: any) {
        console.error('[CardPaymentScreen] SDK load error:', err);
        setErrorMessage(err.message || 'Erro ao configurar pagamento');
        setStatus('error');
      }
    };

    loadMercadoPagoSDK();
  }, [companyId]);

  // Detect card brand and fetch installments
  useEffect(() => {
    const brandInfo = detectCardBrand(cardNumber);
    setCardBrandInfo(brandInfo);
    
    // Fetch installment options when we have 6+ digits
    const cardDigits = cardNumber.replace(/\D/g, '');
    if (cardDigits.length >= 6 && mpInstanceRef.current && brandInfo.brand !== 'unknown') {
      fetchInstallments(cardDigits.slice(0, 6));
    } else {
      // Generate default installment options
      generateDefaultInstallments();
    }
  }, [cardNumber, total]);

  const generateDefaultInstallments = () => {
    const options: InstallmentOption[] = [];
    for (let i = 1; i <= Math.min(maxInstallments, 12); i++) {
      options.push({
        installments: i,
        installment_amount: total / i,
        total_amount: total,
      });
    }
    setInstallmentOptions(options);
  };

  const fetchInstallments = async (bin: string) => {
    if (!mpInstanceRef.current) return;
    
    setLoadingInstallments(true);
    try {
      const response = await mpInstanceRef.current.getInstallments({
        amount: String(total),
        bin: bin,
      });
      
      if (response && response.length > 0 && response[0].payer_costs) {
        const options = response[0].payer_costs
          .filter((cost: any) => cost.installments <= maxInstallments)
          .map((cost: any) => ({
            installments: cost.installments,
            installment_amount: cost.installment_amount,
            total_amount: cost.total_amount,
            recommended_message: cost.recommended_message,
          }));
        setInstallmentOptions(options);
      }
    } catch (err) {
      console.warn('[CardPaymentScreen] Could not fetch installments, using defaults');
      generateDefaultInstallments();
    } finally {
      setLoadingInstallments(false);
    }
  };

  // Validate form
  useEffect(() => {
    const cardDigits = cardNumber.replace(/\D/g, '');
    const expiryDigits = expiry.replace(/\D/g, '');
    const cvvDigits = cvv.replace(/\D/g, '');
    const cpfDigits = cpf.replace(/\D/g, '');
    
    const isValid = 
      cardDigits.length >= 13 &&
      cardDigits.length <= 19 &&
      cardholderName.trim().length >= 3 &&
      expiryDigits.length === 4 &&
      cvvDigits.length >= 3 &&
      cvvDigits.length <= 4 &&
      cpfDigits.length === 11;
    
    setIsFormValid(isValid);
  }, [cardNumber, cardholderName, expiry, cvv, cpf]);

  // Cancel payment
  const handleCancelPayment = async () => {
    setCancelling(true);
    try {
      toast({ 
        title: 'Pagamento cancelado', 
        description: 'Você pode escolher outra forma de pagamento.' 
      });
      onCancel();
    } catch (err) {
      console.error('Error cancelling payment:', err);
    } finally {
      setCancelling(false);
    }
  };

  // Submit payment
  const handleSubmit = async () => {
    if (!isFormValid || !mpInstanceRef.current) return;
    
    setStatus('processing');
    setErrorMessage('');

    try {
      const expiryDigits = expiry.replace(/\D/g, '');
      const expirationMonth = expiryDigits.slice(0, 2);
      const expirationYear = '20' + expiryDigits.slice(2, 4);
      const cardNumberClean = cardNumber.replace(/\D/g, '');
      const cpfClean = cpf.replace(/\D/g, '');

      // Create card token using MP SDK
      const cardData = {
        cardNumber: cardNumberClean,
        cardholderName: cardholderName,
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear,
        securityCode: cvv.replace(/\D/g, ''),
        identificationType: 'CPF',
        identificationNumber: cpfClean,
      };

      console.log('[CardPaymentScreen] Creating card token...');
      
      const tokenResponse = await mpInstanceRef.current.createCardToken(cardData);
      
      if (!tokenResponse?.id) {
        throw new Error('Não foi possível processar os dados do cartão');
      }

      console.log('[CardPaymentScreen] Token created:', tokenResponse.id);

      // Send token to backend for payment processing
      const { data, error } = await supabase.functions.invoke('process-card-payment', {
        body: {
          companyId,
          token: tokenResponse.id,
          paymentMethodId: cardBrandInfo.brand !== 'unknown' ? cardBrandInfo.brand : 'visa',
          installments: selectedInstallments,
          cpf: cpfClean,
          items,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddressId,
          deliveryFee,
          subtotal,
          total: installmentOptions.find(o => o.installments === selectedInstallments)?.total_amount || total,
          couponId,
          discountAmount,
          notes,
        },
      });

      // Transport-level error
      if (error) {
        throw new Error('Não foi possível comunicar com o servidor de pagamento. Tente novamente.');
      }

      // Business-level result
      if (data?.success && data?.orderId) {
        setStatus('success');
        toast({
          title: 'Pagamento aprovado!',
          description: 'Seu pedido foi realizado com sucesso.',
        });

        setTimeout(() => {
          onSuccess(data.orderId);
        }, 2000);
        return;
      }

      const backendMessage =
        data?.error ||
        data?.message ||
        'Pagamento não aprovado. Tente novamente ou use outro cartão.';

      throw new Error(backendMessage);
    } catch (err: any) {
      console.error('[CardPaymentScreen] Payment error:', err);

      const userMessage =
        typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : 'Erro ao processar pagamento';

      setErrorMessage(userMessage);
      setStatus('error');
      toast({
        title: 'Erro no pagamento',
        description: userMessage,
        variant: 'destructive',
      });
    }
  };

  // Render content based on status
  const renderContent = () => {
    // Loading screen
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground mt-4">Preparando pagamento seguro...</p>
        </div>
      );
    }

    // Success screen
    if (status === 'success') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6 animate-in zoom-in duration-500">
            <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Pagamento Aprovado!</h2>
          <p className="text-muted-foreground">Seu pedido foi realizado com sucesso.</p>
          <p className="text-sm text-muted-foreground mt-2">Redirecionando...</p>
        </div>
      );
    }

    // Error screen with retry
    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Pagamento Recusado</h2>
          <p className="text-muted-foreground mb-1">{errorMessage}</p>
          <p className="text-sm text-muted-foreground mb-6">
            Verifique os dados do cartão e tente novamente.
          </p>
          <div className="flex gap-3">
            <Button onClick={onCancel} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => setStatus('form')}>
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }

    // Processing screen
    if (status === 'processing') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <CreditCard className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Processando pagamento...</h2>
          <p className="text-muted-foreground">Aguarde enquanto validamos seu cartão</p>
          <p className="text-xs text-muted-foreground mt-2">Não feche esta tela</p>
        </div>
      );
    }

    // Payment form
    return (
      <div className="flex flex-col">
        {/* Header - Only show if not modal */}
        {!isModal && (
          <header className="sticky top-0 z-10 bg-card border-b border-border p-4">
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Pagamento com Cartão
              </h1>
              <div className="w-10" />
            </div>
          </header>
        )}

        <div className={`p-4 ${isModal ? '' : 'max-w-lg mx-auto w-full'}`}>
          {/* Amount Card */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 mb-6 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor total</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{companyName}</p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                  <Shield className="w-3 h-3" />
                  <span>Compra segura</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Form */}
          <div className="space-y-4">
            {/* Card Number */}
            <div className="space-y-2">
              <Label htmlFor="cardNumber" className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                Número do Cartão
              </Label>
              <div className="relative">
                <Input
                  id="cardNumber"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="pr-16 h-12 text-lg font-mono"
                />
                {cardBrandInfo.brand !== 'unknown' && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase ${cardBrandColors[cardBrandInfo.brand]}`}>
                    {cardBrandInfo.brand}
                  </div>
                )}
              </div>
            </div>

            {/* Cardholder Name */}
            <div className="space-y-2">
              <Label htmlFor="cardholderName" className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-muted-foreground" />
                Nome no Cartão
              </Label>
              <Input
                id="cardholderName"
                type="text"
                placeholder="COMO ESTÁ IMPRESSO NO CARTÃO"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                className="h-12 uppercase"
              />
            </div>

            {/* Expiry, CVV, and CPF */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="expiry" className="flex items-center gap-1 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  Validade
                </Label>
                <Input
                  id="expiry"
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  className="h-12 text-center font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv" className="flex items-center gap-1 text-sm font-medium">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  CVV
                </Label>
                <Input
                  id="cvv"
                  type="text"
                  inputMode="numeric"
                  placeholder="000"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="h-12 text-center font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-1 text-sm font-medium">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  CPF
                </Label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="h-12 text-sm"
                />
              </div>
            </div>

            {/* Installments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                Parcelas
              </Label>
              <Select
                value={String(selectedInstallments)}
                onValueChange={(value) => setSelectedInstallments(Number(value))}
                disabled={loadingInstallments}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione as parcelas" />
                </SelectTrigger>
                <SelectContent>
                  {installmentOptions.map((option) => (
                    <SelectItem key={option.installments} value={String(option.installments)}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>
                          {option.installments}x de {formatCurrency(option.installment_amount)}
                        </span>
                        {option.installments > 1 && option.total_amount > total && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Total: {formatCurrency(option.total_amount)})
                          </span>
                        )}
                        {option.installments === 1 && (
                          <span className="text-xs text-green-600 ml-2">
                            Sem juros
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingInstallments && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calculando parcelas...
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          {selectedInstallments > 1 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parcelas</span>
                <span className="font-medium">
                  {selectedInstallments}x de {formatCurrency(installmentOptions.find(o => o.installments === selectedInstallments)?.installment_amount || total / selectedInstallments)}
                </span>
              </div>
              {installmentOptions.find(o => o.installments === selectedInstallments)?.total_amount !== total && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Total com juros</span>
                  <span className="font-medium">
                    {formatCurrency(installmentOptions.find(o => o.installments === selectedInstallments)?.total_amount || total)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          <Button
            className="w-full mt-6 h-14 text-lg font-semibold"
            size="lg"
            onClick={handleSubmit}
            disabled={!isFormValid}
          >
            <Lock className="w-5 h-5 mr-2" />
            Pagar {formatCurrency(installmentOptions.find(o => o.installments === selectedInstallments)?.total_amount || total)}
          </Button>

          {/* Cancel button */}
          <Button
            onClick={handleCancelPayment}
            variant="ghost"
            className="w-full mt-2 text-muted-foreground hover:text-foreground"
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            {cancelling ? 'Cancelando...' : 'Escolher outro pagamento'}
          </Button>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4 pb-4">
            <Shield className="w-4 h-4" />
            <span>Pagamento 100% seguro via Mercado Pago</span>
          </div>
        </div>
      </div>
    );
  };

  // Render as modal or full page
  if (isModal) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Pagamento com Cartão</h2>
          </div>
          {renderContent()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {renderContent()}
    </div>
  );
}
