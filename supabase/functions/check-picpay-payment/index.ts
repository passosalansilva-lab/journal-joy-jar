import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PicPay APIs
// Payment Link API (para criar cobranças) - usa OAuth2
const PICPAY_OAUTH_BASE = "https://checkout-api.picpay.com";
const PICPAY_PAYMENTLINK_BASE = "https://api.picpay.com/v1/paymentlink";

// E-commerce Public API (para verificar status) - usa x-picpay-token
// Docs: https://developers-business.picpay.com/wallet/en/checkout/resources/api-reference
const PICPAY_ECOMMERCE_BASE = "https://appws.picpay.com/ecommerce/public";

async function getPicPayAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `${PICPAY_OAUTH_BASE}/oauth2/token`;

  console.log(`[check-picpay-payment] Requesting OAuth token from ${tokenUrl}...`);

  const response = await fetch(tokenUrl, {
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

  const responseText = await response.text();
  console.log(`[check-picpay-payment] Token response status: ${response.status}`);

  if (!response.ok) {
    console.error("[check-picpay-payment] Token error:", responseText);
    throw new Error("Erro ao obter token de acesso do PicPay");
  }

  const data = JSON.parse(responseText);
  console.log("[check-picpay-payment] OAuth token obtained successfully");
  return data.access_token;
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

    const { pendingId, companyId, paymentLinkId, referenceId } = await req.json();

    if (!pendingId || !companyId) {
      return new Response(JSON.stringify({ error: "Dados obrigatórios não fornecidos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("[check-picpay-payment] Checking payment:", pendingId);

    // 1) Primeiro verifica se o pedido já foi concluído
    const { data: pendingOrder, error: pendingError } = await supabaseClient
      .from("pending_order_payments")
      .select("*")
      .eq("id", pendingId)
      .single();

    if (pendingError) {
      throw new Error("Pedido não encontrado");
    }

    if (pendingOrder.status === "completed" && pendingOrder.order_id) {
      console.log("[check-picpay-payment] Already completed:", pendingOrder.order_id);
      return new Response(JSON.stringify({ approved: true, orderId: pendingOrder.order_id, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pendingOrder.status === "cancelled") {
      return new Response(JSON.stringify({ approved: false, status: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Credenciais
    const { data: paymentSettings, error: settingsError } = await supabaseClient
      .from("company_payment_settings")
      .select("picpay_client_id, picpay_client_secret, picpay_token")
      .eq("company_id", companyId)
      .eq("picpay_enabled", true)
      .single();

    if (settingsError || !paymentSettings?.picpay_client_id || !paymentSettings?.picpay_client_secret) {
      return new Response(JSON.stringify({ approved: false, status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Determina o ID do Payment Link
    const linkId =
      paymentLinkId ||
      referenceId ||
      pendingOrder.mercadopago_payment_id ||
      null;

    if (!linkId) {
      console.warn("[check-picpay-payment] Missing paymentLinkId for pendingId:", pendingId);
      return new Response(JSON.stringify({ approved: false, status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const approvedStatuses = ["paid", "approved", "completed", "settled", "authorized"];
    let paymentStatus = "pending";
    let foundApproved = false;

    // ============================================================
    // STRATEGY 1: Try E-commerce Public API (x-picpay-token)
    // This is the official way to check payment status
    // Endpoint: GET /payments/{referenceId}/status
    // ============================================================
    if (paymentSettings.picpay_token) {
      try {
        // Use pendingId as referenceId since we pass it during creation
        const ecommerceStatusUrl = `${PICPAY_ECOMMERCE_BASE}/payments/${pendingId}/status`;
        console.log(`[check-picpay-payment] Strategy 1: E-commerce API at ${ecommerceStatusUrl}`);

        const ecommerceResp = await fetch(ecommerceStatusUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-picpay-token": paymentSettings.picpay_token,
          },
        });

        const ecommerceText = await ecommerceResp.text();
        console.log(`[check-picpay-payment] E-commerce API response status: ${ecommerceResp.status}`);
        console.log(`[check-picpay-payment] E-commerce API response body: ${ecommerceText}`);

        if (ecommerceResp.ok) {
          const ecommerceData = JSON.parse(ecommerceText);
          const ecommerceStatus = String(ecommerceData.status || "").toLowerCase();
          console.log(`[check-picpay-payment] E-commerce API status: ${ecommerceStatus}`);

          if (approvedStatuses.includes(ecommerceStatus)) {
            paymentStatus = ecommerceStatus;
            foundApproved = true;
            console.log("[check-picpay-payment] Payment approved via E-commerce API!");
          } else if (["expired", "refunded", "cancelled", "canceled"].includes(ecommerceStatus)) {
            paymentStatus = ecommerceStatus;
          }
        }
      } catch (e) {
        console.warn("[check-picpay-payment] E-commerce API failed:", e);
      }
    }

    // ============================================================
    // STRATEGY 2: Try Payment Link API with OAuth2 (fallback)
    // Query /paymentlink/{id} and /paymentlink/{id}/transactions
    // ============================================================
    if (!foundApproved) {
      try {
        const accessToken = await getPicPayAccessToken(
          paymentSettings.picpay_client_id,
          paymentSettings.picpay_client_secret
        );

        // 2a) Check main paymentlink endpoint
        const statusUrl = `${PICPAY_PAYMENTLINK_BASE}/${linkId}`;
        console.log(`[check-picpay-payment] Strategy 2a: Payment Link API at ${statusUrl}`);

        const picpayResponse = await fetch(statusUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const responseText = await picpayResponse.text();
        console.log(`[check-picpay-payment] Payment Link API response status: ${picpayResponse.status}`);
        console.log(`[check-picpay-payment] Payment Link API response body: ${responseText}`);

        if (picpayResponse.ok) {
          const paymentData = JSON.parse(responseText);

          // Try multiple status fields
          const rawStatus =
            paymentData.status ||
            paymentData.charge?.status ||
            paymentData.payment?.status ||
            paymentData.transaction?.status ||
            paymentData.payments?.[0]?.status ||
            "";

          const normalizedStatus = String(rawStatus).toLowerCase();
          console.log(`[check-picpay-payment] Payment Link status: ${normalizedStatus}`);

          if (approvedStatuses.includes(normalizedStatus)) {
            paymentStatus = normalizedStatus;
            foundApproved = true;
          } else if (["expired", "inactive", "cancelled", "canceled", "refunded"].includes(normalizedStatus)) {
            paymentStatus = normalizedStatus;
          }
        }

        // 2b) Check transactions endpoint if still not approved
        if (!foundApproved && !["expired", "inactive", "cancelled", "canceled", "refunded"].includes(paymentStatus)) {
          const txUrl = `${PICPAY_PAYMENTLINK_BASE}/${linkId}/transactions`;
          console.log(`[check-picpay-payment] Strategy 2b: Transactions endpoint at ${txUrl}`);

          const txResp = await fetch(txUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const txText = await txResp.text();
          console.log(`[check-picpay-payment] Transactions response status: ${txResp.status}`);
          console.log(`[check-picpay-payment] Transactions response body: ${txText}`);

          if (txResp.ok) {
            const txJson = JSON.parse(txText);
            const txList =
              (Array.isArray(txJson) ? txJson : null) ||
              txJson.transactions ||
              txJson.data ||
              txJson.items ||
              [];

            if (Array.isArray(txList) && txList.length) {
              for (const tx of txList) {
                const txStatus = String(
                  tx.status ||
                  tx.transaction_status ||
                  tx.payment_status ||
                  tx.state ||
                  tx.situation ||
                  ""
                ).toLowerCase();

                console.log(`[check-picpay-payment] Transaction status: ${txStatus}`);

                if (approvedStatuses.includes(txStatus)) {
                  paymentStatus = txStatus;
                  foundApproved = true;
                  console.log("[check-picpay-payment] Payment approved via transactions endpoint!");
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[check-picpay-payment] Payment Link API failed:", e);
      }
    }

    console.log(`[check-picpay-payment] Final resolved status: ${paymentStatus}, approved: ${foundApproved}`);

    // ============================================================
    // Create order if approved
    // ============================================================
    if (foundApproved) {
      const { error: updateError } = await supabaseClient
        .from("pending_order_payments")
        .update({ status: "processing" })
        .eq("id", pendingId)
        .eq("status", "pending");

      if (updateError) {
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

    // Cancelled/Expired
    if (["expired", "inactive", "cancelled", "canceled", "refunded"].includes(paymentStatus)) {
      return new Response(JSON.stringify({ approved: false, status: paymentStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Still pending
    return new Response(JSON.stringify({ approved: false, status: paymentStatus || "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-picpay-payment] Error:", error);
    return new Response(JSON.stringify({ error: String(error), approved: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});