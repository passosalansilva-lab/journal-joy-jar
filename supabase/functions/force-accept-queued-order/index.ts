import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * This function allows a driver to force accept a queued order,
 * skipping the queue and taking the order immediately.
 * Useful when the driver can handle multiple deliveries or wants to prioritize.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId, driverId } = await req.json();

    if (!orderId || !driverId) {
      return new Response(
        JSON.stringify({ error: 'orderId and driverId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[force-accept-queued-order] Driver ${driverId} forcing order ${orderId}`);

    // Verify the order belongs to this driver and is queued
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, delivery_driver_id, queue_position, customer_name, company_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[force-accept-queued-order] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (order.delivery_driver_id !== driverId) {
      return new Response(
        JSON.stringify({ error: 'Order does not belong to this driver' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify status is queued
    if (order.status !== 'queued') {
      return new Response(
        JSON.stringify({ error: 'Order is not in queue', currentStatus: order.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Move the order to awaiting_driver (driver can then accept it normally)
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'awaiting_driver',
        queue_position: null,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[force-accept-queued-order] Error updating order:', updateError);
      throw updateError;
    }

    // Reorder remaining queued orders for this driver
    const { data: remainingOrders } = await supabase
      .from('orders')
      .select('id, queue_position')
      .eq('delivery_driver_id', driverId)
      .eq('status', 'queued')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true });

    if (remainingOrders && remainingOrders.length > 0) {
      for (let i = 0; i < remainingOrders.length; i++) {
        await supabase
          .from('orders')
          .update({ queue_position: i + 1 })
          .eq('id', remainingOrders[i].id);
      }
      console.log(`[force-accept-queued-order] Reordered ${remainingOrders.length} remaining queued orders`);
    }

    console.log(`[force-accept-queued-order] Order ${orderId} moved from queue to awaiting_driver`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order moved to awaiting_driver',
        order: {
          id: order.id,
          customerName: order.customer_name,
        },
        remainingInQueue: remainingOrders?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[force-accept-queued-order] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
