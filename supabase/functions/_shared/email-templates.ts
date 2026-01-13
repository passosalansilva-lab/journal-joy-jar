import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  variables: { name: string; description: string; example: string }[];
  is_active: boolean;
}

/**
 * Busca a URL base da plataforma dos system_settings.
 * Retorna a URL configurada ou um fallback.
 */
export async function getPlatformUrl(): Promise<string> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "platform_url")
      .maybeSingle();

    if (error || !data?.value) {
      console.log("Platform URL not found in settings, using default");
      return "https://www.cardpondelivery.com";
    }

    return data.value;
  } catch (err) {
    console.error("Error fetching platform URL:", err);
    return "https://www.cardpondelivery.com";
  }
}

/**
 * Busca um template de email do banco de dados pelo slug.
 * Retorna null se não encontrar ou se o template estiver inativo.
 */
export async function getEmailTemplate(slug: string): Promise<EmailTemplate | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching email template '${slug}':`, error);
      return null;
    }

    return data as EmailTemplate | null;
  } catch (err) {
    console.error(`Exception fetching email template '${slug}':`, err);
    return null;
  }
}

/**
 * Converte camelCase para snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Substitui variáveis no template HTML.
 * Suporta variáveis nos formatos:
 * - {{variavel}}
 * - {{variavel_snake_case}}
 * - Converte automaticamente camelCase para snake_case
 */
export function replaceTemplateVariables(
  html: string,
  variables: Record<string, string | number>
): string {
  let result = html;
  
  for (const [key, value] of Object.entries(variables)) {
    // Substituir variável no formato original
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
    
    // Substituir também no formato snake_case (se o key for camelCase)
    const snakeKey = camelToSnake(key);
    if (snakeKey !== key) {
      const snakeRegex = new RegExp(`\\{\\{${snakeKey}\\}\\}`, 'g');
      result = result.replace(snakeRegex, String(value));
    }
  }
  
  return result;
}

/**
 * Substitui variáveis no subject do email.
 */
export function replaceSubjectVariables(
  subject: string,
  variables: Record<string, string | number>
): string {
  return replaceTemplateVariables(subject, variables);
}
