import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PicPay Payment Link API
const PICPAY_OAUTH_URL = "https://checkout-api.picpay.com/oauth2/token";
const PICPAY_PAYMENTLINK_BASE = "https://api.picpay.com/v1/paymentlink";

const FUNCTION_VERSION = "2026-01-13T22:00:00Z";

// Status que indicam pagamento aprovado (case insensitive)
const APPROVED_STATUSES = [
  "paid", "approved", "completed", "settled", "authorized", "captured",
  "confirmed", "processed", "success", "successful", "done", "accepted"
];

// Status que indicam cancelamento/expiração
const CANCELLED_STATUSES = [
  "expired", "inactive", "cancelled", "canceled", "refunded", "rejected",
  "failed", "denied", "error", "timeout", "voided"
];

async function getPicPayAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("[check-picpay-payment] Requesting OAuth token...");

  const response = await fetch(PICPAY_OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[check-picpay-payment] Token error:", errorText);
    throw new Error("Erro ao obter token de acesso do PicPay");
  }

  const data = await response.json();
  console.log("[check-picpay-payment] OAuth token obtained successfully");
  return data.access_token;
}

// Função recursiva para encontrar status em qualquer nível do objeto
function findStatusInObject(obj: any, depth = 0): { status: string; path: string } | null {
  if (!obj || typeof obj !== "object" || depth > 5) return null;

  // Campos que podem conter status
  const statusFields = [
    "status", "payment_status", "charge_status", "transaction_status",
    "state", "paymentStatus", "chargeStatus", "transactionStatus"
  ];

  // Verificar campos de status diretos
  for (const field of statusFields) {
    if (obj[field] && typeof obj[field] === "string") {
      return { status: obj[field].toLowerCase(), path: field };
    }
  }

  // Verificar campos aninhados comuns
  const nestedFields = [
    "data", "charge", "payment", "transaction", "result",
    "response", "body", "content", "details"
  ];

  for (const field of nestedFields) {
    if (obj[field] && typeof obj[field] === "object") {
      const result = findStatusInObject(obj[field], depth + 1);
      if (result) {
        return { status: result.status, path: `${field}.${result.path}` };
      }
    }
  }

  // Verificar arrays de transações
  const arrayFields = ["transactions", "payments", "items", "charges"];
  for (const field of arrayFields) {
    if (Array.isArray(obj[field]) && obj[field].length > 0) {
      // Buscar a transação mais recente com status aprovado
      for (const item of obj[field]) {
        const result = findStatusInObject(item, depth + 1);
        if (result && APPROVED_STATUSES.includes(result.status)) {
          return { status: result.status, path: `${field}[].${result.path}` };
        }
      }
      // Se nenhum aprovado, retornar o primeiro status encontrado
      for (const item of obj[field]) {
        const result = findStatusInObject(item, depth + 1);
        if (result) {
          return { status: result.status, path: `${field}[].${result.path}` };
        }
      }
    }
  }

  return null;
}

// Verificar se o objeto contém indicadores de pagamento bem-sucedido
function hasPaymentSuccessIndicators(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;

  const jsonStr = JSON.stringify(obj).toLowerCase();
  
  // Indicadores positivos de pagamento
  const positiveIndicators = [
    '"paid"', '"approved"', '"completed"', '"settled"',
    '"authorized"', '"captured"', '"confirmed"', '"success"',
    '"is_paid":true', '"ispaid":true', '"paid":true',
    '"payment_confirmed"', '"transaction_approved"'
  ];

  for (const indicator of positiveIndicators) {
    if (jsonStr.includes(indicator)) {
      console.log("[check-picpay-payment] Found positive indicator:", indicator);
      return true;
    }
  }

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { pendingId, companyId, paymentLinkId } = await req.json();

    if (!pendingId || !companyId) {
      return new Response(JSON.stringify({ error: "Dados obrigatórios não fornecidos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("[check-picpay-payment] ========================================");
    console.log("[check-picpay-payment] Version:", FUNCTION_VERSION);
    console.log("[check-picpay-payment] Checking payment for pendingId:", pendingId);

    // 1) Verificar se o pedido já foi processado
    const { data: pendingOrder, error: pendingError } = await supabaseClient
      .from("pending_order_payments")
      .select("*")
      .eq("id", pendingId)
      .single();

    if (pendingError) {
      throw new Error("Pedido não encontrado");
    }

    console.log("[check-picpay-payment] Pending order status:", pendingOrder.status);

    // Já completado
    if (pendingOrder.status === "completed" && pendingOrder.order_id) {
      console.log("[check-picpay-payment] Already completed:", pendingOrder.order_id);
      return new Response(JSON.stringify({ approved: true, orderId: pendingOrder.order_id, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já cancelado
    if (pendingOrder.status === "cancelled") {
      return new Response(JSON.stringify({ approved: false, status: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Buscar credenciais
    const { data: paymentSettings, error: settingsError } = await supabaseClient
      .from("company_payment_settings")
      .select("picpay_client_id, picpay_client_secret")
      .eq("company_id", companyId)
      .eq("picpay_enabled", true)
      .single();

    if (settingsError || !paymentSettings?.picpay_client_id || !paymentSettings?.picpay_client_secret) {
      console.error("[check-picpay-payment] PicPay not configured");
      return new Response(JSON.stringify({ approved: false, status: "pending", error: "PicPay não configurado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Determinar o ID do link de pagamento
    const linkId = paymentLinkId || pendingOrder.mercadopago_payment_id;

    if (!linkId) {
      console.warn("[check-picpay-payment] No paymentLinkId available!");
      return new Response(JSON.stringify({ approved: false, status: "pending", error: "ID do link não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[check-picpay-payment] Using linkId:", linkId);

    // 4) Obter token OAuth
    const accessToken = await getPicPayAccessToken(
      paymentSettings.picpay_client_id,
      paymentSettings.picpay_client_secret
    );

    let paymentStatus = "pending";
    let foundApproved = false;

    // ============================================================
    // PASSO A: Consultar GET /paymentlink/{id}
    // ============================================================
    const statusUrl = `${PICPAY_PAYMENTLINK_BASE}/${linkId}`;
    console.log(`[check-picpay-payment] Step A: Querying ${statusUrl}`);

    const picpayResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseText = await picpayResponse.text();
    console.log(`[check-picpay-payment] Step A response status: ${picpayResponse.status}`);
    console.log(`[check-picpay-payment] Step A response body: ${responseText.slice(0, 1000)}`);

    if (picpayResponse.ok) {
      try {
        const paymentData = JSON.parse(responseText);
        
        // Usar nova função de busca recursiva
        const statusResult = findStatusInObject(paymentData);
        if (statusResult) {
          console.log(`[check-picpay-payment] Step A found status: ${statusResult.status} at path: ${statusResult.path}`);
          
          if (APPROVED_STATUSES.includes(statusResult.status)) {
            paymentStatus = statusResult.status;
            foundApproved = true;
            console.log("[check-picpay-payment] Step A: APPROVED!", statusResult.status);
          } else if (CANCELLED_STATUSES.includes(statusResult.status)) {
            paymentStatus = statusResult.status;
            console.log("[check-picpay-payment] Step A: CANCELLED!", statusResult.status);
          }
        }

        // Verificação adicional por indicadores
        if (!foundApproved && hasPaymentSuccessIndicators(paymentData)) {
          console.log("[check-picpay-payment] Step A: Found success indicators!");
          paymentStatus = "approved";
          foundApproved = true;
        }
      } catch (parseErr) {
        console.error("[check-picpay-payment] Step A parse error:", parseErr);
      }
    }

    // ============================================================
    // PASSO B: Se não aprovado, consultar transações
    // ============================================================
    if (!foundApproved && !CANCELLED_STATUSES.includes(paymentStatus)) {
      const txUrl = `${PICPAY_PAYMENTLINK_BASE}/${linkId}/transactions`;
      console.log(`[check-picpay-payment] Step B: Querying ${txUrl}`);

      try {
        const txResp = await fetch(txUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const txText = await txResp.text();
        console.log(`[check-picpay-payment] Step B response status: ${txResp.status}`);
        console.log(`[check-picpay-payment] Step B response body: ${txText.slice(0, 1000)}`);

        if (txResp.ok && txText && txText !== "[]" && txText !== "{}") {
          const txJson = JSON.parse(txText);

          // Se há transações, isso pode indicar pagamento
          const hasTransactions = 
            (Array.isArray(txJson) && txJson.length > 0) ||
            (txJson.transactions && Array.isArray(txJson.transactions) && txJson.transactions.length > 0) ||
            (txJson.items && Array.isArray(txJson.items) && txJson.items.length > 0) ||
            (txJson.data && Array.isArray(txJson.data) && txJson.data.length > 0) ||
            (txJson.content && Array.isArray(txJson.content) && txJson.content.length > 0);

          console.log("[check-picpay-payment] Step B has transactions:", hasTransactions);

          // Usar busca recursiva no resultado
          const statusResult = findStatusInObject(txJson);
          if (statusResult) {
            console.log(`[check-picpay-payment] Step B found status: ${statusResult.status} at path: ${statusResult.path}`);

            if (APPROVED_STATUSES.includes(statusResult.status)) {
              paymentStatus = statusResult.status;
              foundApproved = true;
              console.log("[check-picpay-payment] Step B: APPROVED!", statusResult.status);
            } else if (CANCELLED_STATUSES.includes(statusResult.status)) {
              paymentStatus = statusResult.status;
            }
          }

          // Verificação adicional por indicadores
          if (!foundApproved && hasPaymentSuccessIndicators(txJson)) {
            console.log("[check-picpay-payment] Step B: Found success indicators!");
            paymentStatus = "approved";
            foundApproved = true;
          }

          // Se tem transações mas não encontrou status específico,
          // pode ser que a API use uma estrutura diferente
          if (!foundApproved && hasTransactions) {
            console.log("[check-picpay-payment] Step B: Has transactions but no approved status - checking raw values");
            
            // Log detalhado para debugging
            const txList = Array.isArray(txJson) ? txJson :
                           txJson.transactions || txJson.items || txJson.data || txJson.content || [];
            
            if (Array.isArray(txList)) {
              for (let i = 0; i < Math.min(txList.length, 3); i++) {
                console.log(`[check-picpay-payment] Step B transaction[${i}]:`, JSON.stringify(txList[i]).slice(0, 500));
              }
            }
          }
        }
      } catch (txErr) {
        console.warn("[check-picpay-payment] Step B error:", txErr);
      }
    }

    console.log("[check-picpay-payment] ========================================");
    console.log("[check-picpay-payment] FINAL: status =", paymentStatus, ", approved =", foundApproved);

    // ============================================================
    // Criar pedido se aprovado
    // ============================================================
    if (foundApproved) {
      // Marcar como processando para evitar duplicatas
      const { error: updateError } = await supabaseClient
        .from("pending_order_payments")
        .update({ status: "processing" })
        .eq("id", pendingId)
        .eq("status", "pending");

      if (updateError) {
        // Verificar se já foi processado por webhook
        const { data: recheckOrder } = await supabaseClient
          .from("pending_order_payments")
          .select("order_id, status")
          .eq("id", pendingId)
          .single();

        if (recheckOrder?.order_id) {
          return new Response(JSON.stringify({ approved: true, orderId: recheckOrder.order_id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const orderData = pendingOrder.order_data as any;
      const newOrderId = crypto.randomUUID();
      const estimatedDeliveryTime = new Date();
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 45);

      // Criar pedido
      const { error: orderError } = await supabaseClient.from("orders").insert({
        id: newOrderId,
        company_id: companyId,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone || "",
        customer_email: orderData.customer_email?.toLowerCase() || null,
        delivery_address_id: orderData.delivery_address_id,
        payment_method: "pix",
        payment_status: "paid",
        subtotal: orderData.subtotal,
        delivery_fee: orderData.delivery_fee,
        total: orderData.total,
        notes: orderData.notes || null,
        coupon_id: orderData.coupon_id || null,
        discount_amount: orderData.discount_amount || 0,
        estimated_delivery_time: estimatedDeliveryTime.toISOString(),
        stripe_payment_intent_id: `picpay_${linkId}`,
        table_session_id: orderData.table_session_id || null,
        source: orderData.source || "online",
      });

      if (orderError) {
        console.error("[check-picpay-payment] Error creating order:", orderError);
        throw new Error("Erro ao criar pedido");
      }

      // Criar itens do pedido
      const orderItems = (orderData.items || []).map((item: any) => ({
        order_id: newOrderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        options: item.options || [],
        notes: item.notes || null,
      }));

      if (orderItems.length) {
        await supabaseClient.from("order_items").insert(orderItems);
      }

      // Atualizar pedido pendente como completo
      await supabaseClient
        .from("pending_order_payments")
        .update({
          status: "completed",
          order_id: newOrderId,
          completed_at: new Date().toISOString(),
        })
        .eq("id", pendingId);

      console.log("[check-picpay-payment] Order created successfully:", newOrderId);

      return new Response(JSON.stringify({ approved: true, orderId: newOrderId, status: "paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancelado/Expirado
    if (CANCELLED_STATUSES.includes(paymentStatus)) {
      return new Response(JSON.stringify({ approved: false, status: paymentStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ainda pendente
    return new Response(JSON.stringify({ approved: false, status: paymentStatus || "pending", functionVersion: FUNCTION_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-picpay-payment] Error:", error);
    return new Response(JSON.stringify({ error: String(error), approved: false, functionVersion: FUNCTION_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
