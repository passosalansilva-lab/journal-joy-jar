import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION-EXPIRATIONS] ${step}${detailsStr}`);
};

const GRACE_PERIOD_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    logStep("Starting subscription expiration check");

    const now = new Date();
    const todayStr = now.toISOString();

    // 1. Buscar empresas com assinaturas ativas que precisam de verificação
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        owner_id,
        subscription_plan,
        subscription_status,
        subscription_end_date,
        subscription_grace_end_date
      `)
      .in("subscription_status", ["active", "grace_period"])
      .not("subscription_plan", "is", null);

    if (companiesError) {
      throw new Error(`Error fetching companies: ${companiesError.message}`);
    }

    logStep("Found companies to check", { count: companies?.length || 0 });

    const results = {
      checked: 0,
      gracePeriodActivated: 0,
      gracePeriodWarnings: 0,
      expired: 0,
      expiringSOON: 0,
      errors: [] as string[],
    };

    for (const company of companies || []) {
      try {
        results.checked++;
        
        const endDate = company.subscription_end_date ? new Date(company.subscription_end_date) : null;
        const graceEndDate = company.subscription_grace_end_date ? new Date(company.subscription_grace_end_date) : null;

        // Buscar nome do plano
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("name")
          .eq("key", company.subscription_plan)
          .single();

        const planName = plan?.name || company.subscription_plan;

        // CASO 1: Assinatura ativa, verificar se expirou ou vai expirar
        if (company.subscription_status === "active" && endDate) {
          const daysUntilExpiration = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Expirou hoje ou já passou → ativar grace period
          if (daysUntilExpiration <= 0) {
            const graceEnd = new Date();
            graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

            await supabase
              .from("companies")
              .update({
                subscription_status: "grace_period",
                subscription_grace_end_date: graceEnd.toISOString(),
                updated_at: todayStr,
              })
              .eq("id", company.id);

            // Enviar email de grace period
            await sendAlert(company.id, company.owner_id, "grace_period", planName, graceEnd.toISOString());
            
            results.gracePeriodActivated++;
            logStep("Grace period activated", { companyId: company.id, graceEnd: graceEnd.toISOString() });
          }
          // Expira em 3 dias → aviso de expiração
          else if (daysUntilExpiration <= 3 && daysUntilExpiration > 0) {
            await sendAlert(company.id, company.owner_id, "expiring_soon", planName);
            results.expiringSOON++;
            logStep("Expiring soon alert sent", { companyId: company.id, daysLeft: daysUntilExpiration });
          }
        }

        // CASO 2: Em grace period, verificar se expirou ou está acabando
        if (company.subscription_status === "grace_period" && graceEndDate) {
          const daysUntilGraceEnd = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Grace period expirou → rebaixar para free
          if (daysUntilGraceEnd <= 0) {
            await supabase
              .from("companies")
              .update({
                subscription_status: "free",
                subscription_plan: null,
                subscription_end_date: null,
                subscription_grace_end_date: null,
                updated_at: todayStr,
              })
              .eq("id", company.id);

            // Enviar email de expiração
            await sendAlert(company.id, company.owner_id, "expired", planName);
            
            results.expired++;
            logStep("Subscription expired", { companyId: company.id });
          }
          // Faltam 2 dias para o grace period acabar → último aviso
          else if (daysUntilGraceEnd <= 2 && daysUntilGraceEnd > 0) {
            await sendAlert(company.id, company.owner_id, "grace_period_ending", planName, graceEndDate.toISOString());
            results.gracePeriodWarnings++;
            logStep("Grace period ending warning sent", { companyId: company.id, daysLeft: daysUntilGraceEnd });
          }
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Company ${company.id}: ${errorMsg}`);
        logStep("Error processing company", { companyId: company.id, error: errorMsg });
      }
    }

    logStep("Check completed", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Fatal error", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendAlert(
  companyId: string, 
  ownerId: string, 
  type: string, 
  planName: string,
  graceEndDate?: string
) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-subscription-payment-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        companyId,
        ownerId,
        type,
        planName,
        graceEndDate,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep("Failed to send alert", { type, companyId, error: errorText });
    } else {
      logStep("Alert sent successfully", { type, companyId });
    }
  } catch (err) {
    logStep("Error sending alert", { type, companyId, error: String(err) });
  }
}
