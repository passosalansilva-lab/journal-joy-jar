import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-SUBSCRIPTION-ALERT] ${step}${detailsStr}`);
};

type AlertType = 
  | "payment_failed"      // Falha na cobrança do cartão
  | "payment_pending"     // Pagamento pendente (PIX não pago)
  | "expiring_soon"       // Assinatura vai expirar em breve
  | "grace_period"        // Entrou no período de carência
  | "grace_period_ending" // Período de carência vai acabar
  | "expired";            // Assinatura expirou

interface AlertRequest {
  companyId: string;
  ownerId: string;
  type: AlertType;
  planName?: string;
  graceEndDate?: string;
  amount?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { companyId, ownerId, type, planName, graceEndDate, amount }: AlertRequest = await req.json();

    logStep("Processing alert", { companyId, ownerId, type });

    if (!companyId || !ownerId || !type) {
      return new Response(
        JSON.stringify({ error: "companyId, ownerId e type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados da empresa
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name, email, slug")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      logStep("Error fetching company", { error: companyError });
      return new Response(
        JSON.stringify({ error: "Empresa não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar email do owner
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(ownerId);

    if (userError || !userData?.user?.email) {
      logStep("Error fetching user", { error: userError });
      return new Response(
        JSON.stringify({ error: "Email do usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ownerEmail = userData.user.email;
    const ownerName = userData.user.user_metadata?.full_name || company.name;
    const plan = planName || "seu plano";
    const formattedAmount = amount ? `R$ ${amount.toFixed(2).replace('.', ',')}` : '';
    const graceEnd = graceEndDate ? new Date(graceEndDate).toLocaleDateString('pt-BR') : '';

    // Gerar conteúdo do email baseado no tipo
    const emailContent = getEmailContent(type, {
      ownerName,
      companyName: company.name,
      planName: plan,
      graceEnd,
      amount: formattedAmount,
    });

    logStep("Sending email to", { email: ownerEmail, type });

    // Enviar email via Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CardpOn <contato@cardpondelivery.com>",
        to: [ownerEmail],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const emailResponse = await res.json();
    logStep("Email response", { status: res.status, id: emailResponse.id });

    if (!res.ok) {
      throw new Error(emailResponse.message || "Falha ao enviar email");
    }

    // Criar notificação no sistema também
    await supabase.from("notifications").insert({
      user_id: ownerId,
      title: emailContent.notificationTitle,
      message: emailContent.notificationMessage,
      type: emailContent.notificationType,
      data: { 
        type: "subscription_alert",
        alertType: type,
        companyId 
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface EmailParams {
  ownerName: string;
  companyName: string;
  planName: string;
  graceEnd: string;
  amount: string;
}

function getEmailContent(type: AlertType, params: EmailParams) {
  const { ownerName, companyName, planName, graceEnd, amount } = params;
  
  const baseStyles = `
    <style>
      body { margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif; }
    </style>
  `;

  const header = (color: string, icon: string, title: string) => `
    <tr>
      <td style="background:linear-gradient(135deg, ${color}); padding:40px 30px; text-align:center;">
        <h1 style="margin:0; font-size:28px; color:#ffffff; font-weight:700;">
          ${icon} ${title}
        </h1>
      </td>
    </tr>
  `;

  const footer = `
    <tr>
      <td style="background:#f9fafb; padding:25px 30px; text-align:center; border-top:1px solid #e5e7eb;">
        <p style="margin:0; color:#6b7280; font-size:14px;">
          Atenciosamente,<br><strong>Equipe CardpOn</strong>
        </p>
        <p style="margin:15px 0 0; color:#9ca3af; font-size:12px;">
          Este email foi enviado automaticamente pelo sistema CardpOn.
        </p>
      </td>
    </tr>
  `;

  const wrapHtml = (content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:24px 0;">
<tr>
<td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
${content}
${footer}
</table>
</td>
</tr>
</table>
</body>
</html>
  `;

  const renewButton = `
    <div style="text-align:center; margin-top:30px;">
      <a href="https://cardapio-on.lovable.app/dashboard/plans" 
         style="display:inline-block; background:#3b82f6; color:white; text-decoration:none; padding:14px 30px; border-radius:8px; font-weight:600; font-size:16px;">
        Renovar Assinatura
      </a>
    </div>
  `;

  switch (type) {
    case "payment_failed":
      return {
        subject: `Falha no pagamento da assinatura - ${companyName}`,
        notificationTitle: "Falha no pagamento",
        notificationMessage: `Nao foi possivel cobrar sua assinatura. Voce tem 7 dias para regularizar.`,
        notificationType: "warning",
        html: wrapHtml(`
          ${header("#f59e0b 0%, #d97706 100%", "⚠️", "Falha no Pagamento")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Nao conseguimos processar o pagamento da sua assinatura <strong>${planName}</strong> 
                para a empresa <strong>${companyName}</strong>.
              </p>

              <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:15px 20px; margin:25px 0; border-radius:0 8px 8px 0;">
                <p style="margin:0; color:#92400e; font-size:14px;">
                  <strong>Motivo provavel:</strong> Limite insuficiente no cartao ou cartao expirado.
                </p>
              </div>

              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                <strong>Voce tem 7 dias para regularizar</strong> sem que seus pedidos sejam bloqueados. 
                Apos esse periodo, sua conta sera rebaixada para o plano gratuito.
              </p>

              <ul style="color:#374151; font-size:14px; padding-left:20px; margin:0 0 25px;">
                <li style="margin-bottom:10px;">Atualize seus dados de pagamento</li>
                <li style="margin-bottom:10px;">Ou faca uma nova assinatura via PIX</li>
                <li style="margin-bottom:10px;">Seus pedidos continuam funcionando durante a carencia</li>
              </ul>

              ${renewButton}
            </td>
          </tr>
        `),
      };

    case "payment_pending":
      return {
        subject: `Pagamento PIX pendente - ${companyName}`,
        notificationTitle: "Pagamento PIX pendente",
        notificationMessage: `Seu pagamento PIX de ${amount} ainda nao foi confirmado.`,
        notificationType: "info",
        html: wrapHtml(`
          ${header("#3b82f6 0%, #2563eb 100%", "⏳", "Pagamento Pendente")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                O pagamento PIX de <strong>${amount}</strong> para o plano <strong>${planName}</strong> 
                ainda nao foi confirmado.
              </p>

              <div style="background:#dbeafe; border-left:4px solid #3b82f6; padding:15px 20px; margin:25px 0; border-radius:0 8px 8px 0;">
                <p style="margin:0; color:#1e40af; font-size:14px;">
                  Se voce ja realizou o pagamento, aguarde alguns minutos para a confirmacao automatica.
                </p>
              </div>

              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Caso ainda nao tenha pago, acesse o painel para gerar um novo QR Code PIX.
              </p>

              ${renewButton}
            </td>
          </tr>
        `),
      };

    case "expiring_soon":
      return {
        subject: `Sua assinatura vai expirar em breve - ${companyName}`,
        notificationTitle: "Assinatura expirando",
        notificationMessage: `Sua assinatura do plano ${planName} expira em breve. Renove para continuar.`,
        notificationType: "info",
        html: wrapHtml(`
          ${header("#3b82f6 0%, #2563eb 100%", "📅", "Assinatura Expirando")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Sua assinatura do plano <strong>${planName}</strong> para a empresa 
                <strong>${companyName}</strong> vai expirar em breve.
              </p>

              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Para continuar aproveitando todos os beneficios, renove sua assinatura antes do vencimento.
              </p>

              ${renewButton}
            </td>
          </tr>
        `),
      };

    case "grace_period":
      return {
        subject: `Periodo de carencia ativado - ${companyName}`,
        notificationTitle: "Periodo de carencia ativado",
        notificationMessage: `Sua assinatura venceu. Voce tem ate ${graceEnd} para regularizar.`,
        notificationType: "warning",
        html: wrapHtml(`
          ${header("#f59e0b 0%, #d97706 100%", "⏰", "Periodo de Carencia")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Sua assinatura do plano <strong>${planName}</strong> venceu, mas ativamos um 
                <strong>periodo de carencia de 7 dias</strong> para que voce possa regularizar.
              </p>

              <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:15px 20px; margin:25px 0; border-radius:0 8px 8px 0;">
                <p style="margin:0; color:#92400e; font-size:14px;">
                  <strong>Prazo final:</strong> ${graceEnd}
                </p>
              </div>

              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Durante a carencia:
              </p>

              <ul style="color:#374151; font-size:14px; padding-left:20px; margin:0 0 25px;">
                <li style="margin-bottom:10px;">Seus pedidos continuam funcionando normalmente</li>
                <li style="margin-bottom:10px;">Todas as funcionalidades permanecem ativas</li>
                <li style="margin-bottom:10px;">Apos ${graceEnd}, sua conta sera rebaixada para o plano gratuito</li>
              </ul>

              ${renewButton}
            </td>
          </tr>
        `),
      };

    case "grace_period_ending":
      return {
        subject: `URGENTE: Periodo de carencia acabando - ${companyName}`,
        notificationTitle: "Carencia acabando!",
        notificationMessage: `Faltam 2 dias para sua carencia acabar. Renove agora!`,
        notificationType: "error",
        html: wrapHtml(`
          ${header("#ef4444 0%, #dc2626 100%", "🚨", "Carencia Acabando!")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                <strong>Faltam apenas 2 dias</strong> para o fim do periodo de carencia da sua 
                assinatura do plano <strong>${planName}</strong>.
              </p>

              <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:15px 20px; margin:25px 0; border-radius:0 8px 8px 0;">
                <p style="margin:0; color:#991b1b; font-size:14px;">
                  <strong>Data limite:</strong> ${graceEnd}<br>
                  Apos essa data, sua conta sera rebaixada para o plano gratuito automaticamente.
                </p>
              </div>

              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Renove agora para evitar a interrupcao dos seus servicos.
              </p>

              ${renewButton}
            </td>
          </tr>
        `),
      };

    case "expired":
      return {
        subject: `Assinatura expirada - ${companyName}`,
        notificationTitle: "Assinatura expirada",
        notificationMessage: `Sua assinatura expirou. Voce foi rebaixado para o plano gratuito.`,
        notificationType: "error",
        html: wrapHtml(`
          ${header("#ef4444 0%, #dc2626 100%", "❌", "Assinatura Expirada")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Sua assinatura do plano <strong>${planName}</strong> expirou e sua conta foi 
                automaticamente rebaixada para o <strong>plano gratuito</strong>.
              </p>

              <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:15px 20px; margin:25px 0; border-radius:0 8px 8px 0;">
                <p style="margin:0; color:#991b1b; font-size:14px;">
                  <strong>Importante:</strong> Se voce ultrapassar o limite de faturamento do plano gratuito, 
                  seus pedidos podem ser bloqueados.
                </p>
              </div>

              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Voce pode renovar sua assinatura a qualquer momento para recuperar todos os beneficios.
              </p>

              ${renewButton}
            </td>
          </tr>
        `),
      };

    default:
      return {
        subject: `Aviso sobre sua assinatura - ${companyName}`,
        notificationTitle: "Aviso de assinatura",
        notificationMessage: `Ha um aviso sobre sua assinatura.`,
        notificationType: "info",
        html: wrapHtml(`
          ${header("#6b7280 0%, #4b5563 100%", "ℹ️", "Aviso")}
          <tr>
            <td style="padding:40px 30px;">
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ola <strong>${ownerName}</strong>,
              </p>
              <p style="font-size:16px; color:#374151; margin:0 0 20px;">
                Ha um aviso sobre sua assinatura do CardpOn. Acesse o painel para mais detalhes.
              </p>
              ${renewButton}
            </td>
          </tr>
        `),
      };
  }
}
