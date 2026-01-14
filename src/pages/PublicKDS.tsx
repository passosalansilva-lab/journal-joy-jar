import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  ChefHat, 
  CheckCircle, 
  Maximize2, 
  Minimize2,
  RefreshCw,
  Timer,
  AlertTriangle,
  Hand,
  MousePointer2,
  Utensils
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
  options: any;
  requires_preparation: boolean;
}

interface KDSOrder {
  id: string;
  created_at: string;
  customer_name: string;
  status: string;
  source: string;
  notes: string | null;
  order_items: OrderItem[];
  table_session_id: string | null;
}

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-yellow-500", icon: Clock },
  confirmed: { label: "Aguardando", color: "bg-blue-500", icon: Clock },
  preparing: { label: "Preparando", color: "bg-orange-500", icon: ChefHat },
  ready: { label: "Pronto", color: "bg-green-500", icon: CheckCircle },
};

export default function PublicKDS() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [interactionMode, setInteractionMode] = useState(true); // Botões habilitados por padrão

  // Update clock every second for more precision
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Validate token and get company
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("companies")
          .select("id, name, logo_url")
          .eq("kds_token", token)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError("Link do KDS inválido ou expirado");
          setLoading(false);
          return;
        }

        setCompany(data);
      } catch (err) {
        console.error("Error validating KDS token:", err);
        setError("Erro ao validar acesso");
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Fetch orders for kitchen display
  const fetchOrders = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          customer_name,
          status,
          source,
          notes,
          table_session_id,
          order_items (
            id,
            product_name,
            quantity,
            notes,
            options,
            requires_preparation
          )
        `)
        .eq("company_id", company.id)
        .in("status", ["confirmed", "preparing"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error fetching KDS orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (company?.id) {
      fetchOrders();
    }
  }, [company?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel("public-kds-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: "preparing" | "ready") => {
    if (!interactionMode) return;
    
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Pedido marcado como ${statusConfig[newStatus]?.label || newStatus}`,
      });

      fetchOrders();
    } catch (err) {
      console.error("Error updating order status:", err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Calculate time since order in minutes
  const getMinutesSince = (createdAt: string) => {
    const orderTime = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.floor((now - orderTime) / 1000 / 60);
  };

  // Format time display
  const formatTime = (createdAt: string) => {
    const minutes = getMinutesSince(createdAt);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  // Check if order is taking too long
  const getOrderUrgency = (createdAt: string): 'normal' | 'warning' | 'urgent' => {
    const minutes = getMinutesSince(createdAt);
    if (minutes > 20) return 'urgent';
    if (minutes > 10) return 'warning';
    return 'normal';
  };

  // Format options for display
  const formatOptions = (options: any): { groupName: string; items: string[] }[] => {
    if (!options) return [];
    const grouped: Record<string, string[]> = {};
    let hasAnyGroupName = false;

    if (Array.isArray(options)) {
      options.forEach((opt: any) => {
        if (opt.groupName && opt.selectedOptions) {
          hasAnyGroupName = true;
          if (!grouped[opt.groupName]) grouped[opt.groupName] = [];
          opt.selectedOptions.forEach((sel: any) => {
            grouped[opt.groupName].push(sel.name);
          });
        } else if (opt.name) {
          const group = opt.groupName || 'Itens';
          if (opt.groupName) hasAnyGroupName = true;
          if (!grouped[group]) grouped[group] = [];
          grouped[group].push(opt.name);
        }
        if (opt.half_half_flavors) {
          hasAnyGroupName = true;
          if (!grouped['Pizza']) grouped['Pizza'] = [];
          grouped['Pizza'].push(`½ ${opt.half_half_flavors.join(" + ½ ")}`);
        }
      });
    }

    const entries = Object.entries(grouped);
    if (!hasAnyGroupName && entries.length === 1 && entries[0][0] === 'Itens') {
      return entries.map(([groupName, items]) => ({ groupName: '', items }));
    }

    return entries.map(([groupName, items]) => ({ groupName, items }));
  };

  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const preparingOrders = orders.filter((o) => o.status === "preparing");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="h-12 w-12 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl p-8 text-center border border-slate-800 max-w-md">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // Order ticket component
  const OrderTicket = ({ order, status }: { order: KDSOrder; status: 'confirmed' | 'preparing' }) => {
    const urgency = getOrderUrgency(order.created_at);
    const isConfirmed = status === 'confirmed';
    const StatusIcon = statusConfig[status].icon;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "bg-white rounded-xl overflow-hidden shadow-xl",
          urgency === 'urgent' && "ring-4 ring-red-500 animate-pulse",
          urgency === 'warning' && "ring-2 ring-amber-500"
        )}
      >
        {/* Ticket Header */}
        <div className={cn(
          "px-4 py-3 flex items-center justify-between",
          isConfirmed ? "bg-blue-600" : "bg-orange-500"
        )}>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 rounded-lg px-2 py-1">
              <span className="text-white font-mono font-bold text-lg">
                #{order.id.slice(0, 6).toUpperCase()}
              </span>
            </div>
            {order.table_session_id && (
              <Badge className="bg-white/20 text-white border-0">
                <Utensils className="h-3 w-3 mr-1" />
                Mesa
              </Badge>
            )}
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-bold",
            urgency === 'urgent' ? "bg-red-600 text-white" :
            urgency === 'warning' ? "bg-amber-500 text-white" :
            "bg-white/20 text-white"
          )}>
            <Timer className="h-4 w-4" />
            {formatTime(order.created_at)}
          </div>
        </div>

        {/* Customer Name */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
          <p className="font-semibold text-slate-800 truncate">
            {order.customer_name}
          </p>
        </div>

        {/* Order Items */}
        <div className="p-4 space-y-3 bg-white">
          {order.order_items
            .filter((item) => item.requires_preparation)
            .map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{item.quantity}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base leading-tight">
                    {item.product_name}
                  </p>
                  {formatOptions(item.options).map((group, i) => (
                    <p key={i} className="text-sm text-slate-600 leading-tight mt-0.5">
                      {group.groupName ? (
                        <><span className="font-medium">{group.groupName}:</span> {group.items.join(', ')}</>
                      ) : (
                        group.items.map((name, idx) => (
                          <span key={idx}>• {name}{idx < group.items.length - 1 ? ' ' : ''}</span>
                        ))
                      )}
                    </p>
                  ))}
                  {item.notes && (
                    <p className="text-sm text-amber-700 font-medium mt-1 bg-amber-50 px-2 py-0.5 rounded inline-block">
                      📝 {item.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Order Notes */}
        {order.notes && (
          <div className="px-4 pb-3">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 font-medium">
                📝 {order.notes}
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        {interactionMode && (
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <Button
              className={cn(
                "w-full h-14 text-lg font-bold rounded-xl transition-all active:scale-95",
                isConfirmed 
                  ? "bg-orange-500 hover:bg-orange-600 text-white" 
                  : "bg-green-600 hover:bg-green-700 text-white"
              )}
              onClick={() => updateOrderStatus(order.id, isConfirmed ? "preparing" : "ready")}
            >
              {isConfirmed ? (
                <>
                  <ChefHat className="h-6 w-6 mr-2" />
                  INICIAR PREPARO
                </>
              ) : (
                <>
                  <CheckCircle className="h-6 w-6 mr-2" />
                  PRONTO
                </>
              )}
            </Button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4">
            {company?.logo_url && (
              <img 
                src={company.logo_url} 
                alt={company.name} 
                className="h-12 w-12 rounded-xl object-cover border-2 border-slate-700"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <ChefHat className="h-7 w-7 text-orange-500" />
                Cozinha
              </h1>
              <p className="text-sm text-slate-400">{company?.name}</p>
            </div>
          </div>

          {/* Center: Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20">
              <Clock className="h-5 w-5 text-blue-400" />
              <span className="text-2xl font-bold text-blue-400">{confirmedOrders.length}</span>
              <span className="text-sm text-blue-300">aguardando</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20">
              <ChefHat className="h-5 w-5 text-orange-400" />
              <span className="text-2xl font-bold text-orange-400">{preparingOrders.length}</span>
              <span className="text-sm text-orange-300">preparando</span>
            </div>
            {orders.filter(o => getOrderUrgency(o.created_at) === 'urgent').length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 animate-pulse">
                <Timer className="h-5 w-5 text-red-400" />
                <span className="text-2xl font-bold text-red-400">
                  {orders.filter(o => getOrderUrgency(o.created_at) === 'urgent').length}
                </span>
                <span className="text-sm text-red-300">urgentes</span>
              </div>
            )}
          </div>

          {/* Right: Clock & Controls */}
          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <p className="text-3xl font-mono font-bold text-white">
                {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-slate-500">
                {currentTime.toLocaleDateString("pt-BR", { weekday: 'short', day: '2-digit', month: 'short' })}
              </p>
            </div>
            
            {/* Interaction Mode Toggle */}
            <Button
              variant={interactionMode ? "default" : "outline"}
              size="sm"
              onClick={() => setInteractionMode(!interactionMode)}
              className={cn(
                "gap-2",
                interactionMode 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "border-slate-600 text-slate-400 hover:text-white"
              )}
              title={interactionMode ? "Clique para desabilitar botões (modo TV)" : "Clique para habilitar botões (modo Tablet)"}
            >
              {interactionMode ? (
                <>
                  <Hand className="h-4 w-4" />
                  <span className="hidden sm:inline">Touch</span>
                </>
              ) : (
                <>
                  <MousePointer2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Só Ver</span>
                </>
              )}
            </Button>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchOrders}
              className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleFullscreen}
              className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Stats */}
      <div className="md:hidden flex items-center justify-center gap-4 p-3 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20">
          <Clock className="h-4 w-4 text-blue-400" />
          <span className="text-lg font-bold text-blue-400">{confirmedOrders.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/20">
          <ChefHat className="h-4 w-4 text-orange-400" />
          <span className="text-lg font-bold text-orange-400">{preparingOrders.length}</span>
        </div>
      </div>

      {/* Orders Grid */}
      <main className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Confirmed / Waiting Column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600">
                <Clock className="h-5 w-5 text-white" />
                <span className="text-lg font-bold text-white">Aguardando</span>
              </div>
              <span className="text-slate-500 text-sm">{confirmedOrders.length} pedidos</span>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {confirmedOrders.map((order) => (
                  <OrderTicket key={order.id} order={order} status="confirmed" />
                ))}
              </AnimatePresence>
            </div>

            {confirmedOrders.length === 0 && (
              <div className="text-center py-16 text-slate-600">
                <Clock className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Nenhum pedido aguardando</p>
              </div>
            )}
          </div>

          {/* Preparing Column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500">
                <ChefHat className="h-5 w-5 text-white" />
                <span className="text-lg font-bold text-white">Em Preparo</span>
              </div>
              <span className="text-slate-500 text-sm">{preparingOrders.length} pedidos</span>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {preparingOrders.map((order) => (
                  <OrderTicket key={order.id} order={order} status="preparing" />
                ))}
              </AnimatePresence>
            </div>

            {preparingOrders.length === 0 && (
              <div className="text-center py-16 text-slate-600">
                <ChefHat className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Nenhum pedido em preparo</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
