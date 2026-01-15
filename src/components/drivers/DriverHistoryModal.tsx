import { useState, useEffect } from 'react';
import { Loader2, Package, Clock, TrendingUp, Calendar, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInMinutes, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DriverHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: {
    id: string;
    driver_name?: string | null;
    profile?: { full_name: string | null } | null;
  } | null;
  companyId: string;
}

interface DeliveryRecord {
  id: string;
  created_at: string;
  delivered_at: string | null;
  customer_name: string;
  total: number;
  status: string;
  customer_addresses?: {
    neighborhood: string;
    city: string;
  } | null;
}

interface DriverMetrics {
  totalDeliveries: number;
  averageDeliveryTime: number;
  deliveriesThisMonth: number;
  deliveriesToday: number;
  successRate: number;
  fastestDelivery: number;
  slowestDelivery: number;
}

export function DriverHistoryModal({
  open,
  onOpenChange,
  driver,
  companyId,
}: DriverHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [metrics, setMetrics] = useState<DriverMetrics | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (open && driver) {
      loadDriverHistory();
    }
  }, [open, driver, currentMonth]);

  const loadDriverHistory = async () => {
    if (!driver) return;

    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Load all deliveries from driver_deliveries table
      const { data: allDriverDeliveries, error: deliveriesError } = await supabase
        .from('driver_deliveries')
        .select('id, order_id, created_at, delivered_at')
        .eq('company_id', companyId)
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false });

      if (deliveriesError) throw deliveriesError;

      // Also check orders table for any orders assigned to this driver
      const { data: allOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, created_at, delivered_at, customer_name, total, status,
          customer_addresses:delivery_address_id (neighborhood, city)
        `)
        .eq('company_id', companyId)
        .eq('delivery_driver_id', driver.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Get order IDs from driver_deliveries
      const deliveryOrderIds = (allDriverDeliveries || []).map(d => d.order_id).filter(Boolean);

      // Fetch orders for driver_deliveries records
      let deliveryOrders: any[] = [];
      if (deliveryOrderIds.length > 0) {
        const { data: ordersFromDeliveries, error: ordersFromDeliveriesError } = await supabase
          .from('orders')
          .select(`
            id, created_at, delivered_at, customer_name, total, status,
            customer_addresses:delivery_address_id (neighborhood, city)
          `)
          .in('id', deliveryOrderIds);

        if (!ordersFromDeliveriesError && ordersFromDeliveries) {
          deliveryOrders = ordersFromDeliveries;
        }
      }

      // Merge orders from both sources, avoiding duplicates
      const orderMap = new Map();
      
      // Add orders from delivery_driver_id relation
      (allOrders || []).forEach(order => {
        orderMap.set(order.id, order);
      });
      
      // Add orders from driver_deliveries table
      deliveryOrders.forEach(order => {
        if (!orderMap.has(order.id)) {
          orderMap.set(order.id, order);
        }
      });

      // Also create synthetic records from driver_deliveries if order not found
      (allDriverDeliveries || []).forEach(delivery => {
        if (delivery.order_id && !orderMap.has(delivery.order_id)) {
          // Create a synthetic record for display
          orderMap.set(delivery.order_id, {
            id: delivery.order_id,
            created_at: delivery.created_at,
            delivered_at: delivery.delivered_at,
            customer_name: 'Pedido',
            total: 0,
            status: delivery.delivered_at ? 'delivered' : 'out_for_delivery',
            customer_addresses: null,
          });
        }
      });

      const combinedOrders = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Filter for current month display
      const monthDeliveries = combinedOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });

      setDeliveries(monthDeliveries);

      // Calculate metrics from combined data
      const completedDeliveries = combinedOrders.filter(
        (d) => d.status === 'delivered' && d.delivered_at
      );

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const deliveriesToday = completedDeliveries.filter(
        (d) => new Date(d.delivered_at!) >= todayStart
      ).length;

      const thisMonthDeliveries = completedDeliveries.filter((d) => {
        const date = new Date(d.delivered_at!);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Calculate delivery times
      const deliveryTimes = completedDeliveries
        .filter((d) => d.delivered_at)
        .map((d) => differenceInMinutes(new Date(d.delivered_at!), new Date(d.created_at)))
        .filter((t) => t > 0 && t < 300); // Filter out outliers

      const avgTime = deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : 0;

      const fastestTime = deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : 0;
      const slowestTime = deliveryTimes.length > 0 ? Math.max(...deliveryTimes) : 0;

      const totalOrders = combinedOrders.length;
      const successRate = totalOrders > 0
        ? (completedDeliveries.length / totalOrders) * 100
        : 0;

      setMetrics({
        totalDeliveries: completedDeliveries.length,
        averageDeliveryTime: Math.round(avgTime),
        deliveriesThisMonth: thisMonthDeliveries,
        deliveriesToday: deliveriesToday,
        successRate: Math.round(successRate),
        fastestDelivery: fastestTime,
        slowestDelivery: slowestTime,
      });
    } catch (error) {
      console.error('Error loading driver history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setPage(0);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    if (nextMonth <= new Date()) {
      setCurrentMonth(nextMonth);
      setPage(0);
    }
  };

  const paginatedDeliveries = deliveries.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(deliveries.length / pageSize);

  const formatDeliveryTime = (createdAt: string, deliveredAt: string | null) => {
    if (!deliveredAt) return '-';
    const minutes = differenceInMinutes(new Date(deliveredAt), new Date(createdAt));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const driverName = driver?.driver_name || driver?.profile?.full_name || 'Entregador';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Histórico de Entregas - {driverName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics Cards */}
            {metrics && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Entregas</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalDeliveries}</div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.deliveriesToday} hoje
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.averageDeliveryTime} min
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.fastestDelivery}-{metrics.slowestDelivery} min (range)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.deliveriesThisMonth}</div>
                    <p className="text-xs text-muted-foreground">entregas concluídas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.successRate}%</div>
                    <p className="text-xs text-muted-foreground">pedidos entregues</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="font-medium">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                disabled={
                  currentMonth.getMonth() === new Date().getMonth() &&
                  currentMonth.getFullYear() === new Date().getFullYear()
                }
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Deliveries Table */}
            {deliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma entrega encontrada neste período</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDeliveries.map((delivery) => (
                        <TableRow key={delivery.id}>
                          <TableCell className="font-mono text-sm">
                            #{delivery.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{delivery.customer_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {delivery.customer_addresses?.neighborhood || '-'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(delivery.created_at), 'dd/MM HH:mm', {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            {formatDeliveryTime(delivery.created_at, delivery.delivered_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            R$ {delivery.total.toFixed(2).replace('.', ',')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                delivery.status === 'delivered'
                                  ? 'default'
                                  : delivery.status === 'cancelled'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className={
                                delivery.status === 'delivered' ? 'bg-green-500' : ''
                              }
                            >
                              {delivery.status === 'delivered'
                                ? 'Entregue'
                                : delivery.status === 'cancelled'
                                ? 'Cancelado'
                                : 'Em rota'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {page * pageSize + 1} a{' '}
                      {Math.min((page + 1) * pageSize, deliveries.length)} de{' '}
                      {deliveries.length} entregas
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
