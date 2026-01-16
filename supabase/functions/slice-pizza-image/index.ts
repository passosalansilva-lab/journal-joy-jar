import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to log API calls
async function logApiCall(
  supabase: any,
  params: {
    companyId?: string;
    userId?: string;
    provider: string;
    endpoint?: string;
    requestType: string;
    status: string;
    statusCode?: number;
    requestPayload?: any;
    responseData?: any;
    errorMessage?: string;
    durationMs?: number;
  }
) {
  try {
    await supabase.from("ai_api_logs").insert({
      company_id: params.companyId || null,
      user_id: params.userId || null,
      provider: params.provider,
      endpoint: params.endpoint,
      request_type: params.requestType,
      status: params.status,
      status_code: params.statusCode,
      request_payload: params.requestPayload,
      response_data: params.responseData,
      error_message: params.errorMessage,
      duration_ms: params.durationMs,
    });
  } catch (logError) {
    console.error("Failed to log API call:", logError);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let requestBody: any = {};
  let aiProvider = "unknown";

  try {
    requestBody = await req.json();
    const { imageUrl, numberOfSlices, companyId, userId } = requestBody;
    
    if (!imageUrl) {
      await logApiCall(supabase, {
        companyId,
        userId,
        provider: "unknown",
        requestType: "slice-pizza",
        status: "error",
        statusCode: 400,
        requestPayload: { numberOfSlices },
        errorMessage: "imageUrl is required",
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check AI settings from system_settings
    const { data: aiSettings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["ai_enabled", "ai_provider", "ai_api_key"]);

    const settings: Record<string, string> = {};
    aiSettings?.forEach((s: any) => {
      settings[s.key] = s.value;
    });

    const aiEnabled = settings["ai_enabled"] === "true";
    aiProvider = settings["ai_provider"] || "lovable";
    const customApiKey = settings["ai_api_key"] || "";

    if (!aiEnabled) {
      await logApiCall(supabase, {
        companyId,
        userId,
        provider: aiProvider,
        requestType: "slice-pizza",
        status: "error",
        statusCode: 403,
        requestPayload: { numberOfSlices },
        errorMessage: "IA desabilitada",
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ error: "Recursos de IA estão desabilitados. Ative nas configurações do sistema." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which API key and endpoint to use
    let apiKey: string;
    let apiEndpoint: string;
    let model: string;
    let imageModel: string;

    // All providers now use the API key from system_settings
    apiKey = customApiKey;
    
    if (!apiKey) {
      await logApiCall(supabase, {
        companyId,
        userId,
        provider: aiProvider,
        requestType: "slice-pizza",
        status: "error",
        statusCode: 400,
        requestPayload: { numberOfSlices },
        errorMessage: "API Key não configurada",
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ 
          error: "API Key de IA não configurada. Acesse Configurações do Sistema para configurar." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (aiProvider === "lovable") {
      apiEndpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = "google/gemini-2.5-flash";
      imageModel = "google/gemini-2.5-flash-image-preview";
    } else if (aiProvider === "openai") {
      apiEndpoint = "https://api.openai.com/v1/chat/completions";
      model = "gpt-4o";
      imageModel = "gpt-4o";
    } else if (aiProvider === "google") {
      apiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
      model = "gemini-2.0-flash";
      imageModel = "gemini-2.0-flash";
    } else {
      await logApiCall(supabase, {
        companyId,
        userId,
        provider: aiProvider,
        requestType: "slice-pizza",
        status: "error",
        statusCode: 400,
        requestPayload: { numberOfSlices },
        errorMessage: "Provedor não suportado: " + aiProvider,
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ error: "Provedor de IA não suportado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sliceCount = numberOfSlices || 8;
    
    // For now, only Lovable AI is fully implemented for image generation
    if (aiProvider !== "lovable") {
      await logApiCall(supabase, {
        companyId,
        userId,
        provider: aiProvider,
        requestType: "slice-pizza",
        status: "error",
        statusCode: 400,
        requestPayload: { numberOfSlices },
        errorMessage: "Apenas Lovable AI suporta geração de imagens",
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ 
          error: "Apenas Lovable AI suporta geração de imagens no momento. Altere o provedor nas configurações." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the start of the analysis
    console.log(`[AI LOG] Starting pizza analysis - Provider: ${aiProvider}, Slices: ${sliceCount}`);
    
    // First, analyze the image to detect pizza and count slices
    const analysisStartTime = Date.now();
    const analysisResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this pizza image. Count the number of visible slices/cuts. Return ONLY a JSON object with format: {"detectedSlices": number, "isPizza": boolean}. If you can't determine the number of slices, use ${sliceCount} as default.`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
      }),
    });

    const analysisStatusCode = analysisResponse.status;
    
    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error("[AI LOG] Analysis failed:", analysisStatusCode, errorText);
      
      await logApiCall(supabase, {
        companyId,
        userId,
        provider: aiProvider,
        endpoint: apiEndpoint,
        requestType: "slice-pizza-analysis",
        status: "error",
        statusCode: analysisStatusCode,
        requestPayload: { model, sliceCount },
        responseData: { errorText },
        errorMessage: `Analysis failed: ${analysisStatusCode}`,
        durationMs: Date.now() - analysisStartTime,
      });
      
      throw new Error(`Failed to analyze pizza image: ${analysisStatusCode} - ${errorText}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisContent = analysisData.choices?.[0]?.message?.content || "";
    
    console.log(`[AI LOG] Analysis response:`, analysisContent);
    
    // Log successful analysis
    await logApiCall(supabase, {
      companyId,
      userId,
      provider: aiProvider,
      endpoint: apiEndpoint,
      requestType: "slice-pizza-analysis",
      status: "success",
      statusCode: 200,
      requestPayload: { model, sliceCount },
      responseData: { content: analysisContent },
      durationMs: Date.now() - analysisStartTime,
    });
    
    // Extract JSON from response
    let detectedSlices = sliceCount;
    try {
      const jsonMatch = analysisContent.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        detectedSlices = parsed.detectedSlices || sliceCount;
      }
    } catch {
      console.log("[AI LOG] Could not parse slice count, using default:", sliceCount);
    }

    console.log(`[AI LOG] Detected ${detectedSlices} slices, generating images...`);

    // Generate individual slice images
    const sliceImages: string[] = [];
    const sliceErrors: string[] = [];
    
    for (let i = 0; i < detectedSlices; i++) {
      const sliceNumber = i + 1;
      const sliceStartTime = Date.now();
      
      console.log(`[AI LOG] Generating slice ${sliceNumber}/${detectedSlices}...`);
      
      const sliceResponse = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract slice ${sliceNumber} of ${detectedSlices} from this pizza. Create a single pizza slice image with transparent background (PNG). The slice should be isolated, showing just that one triangular piece of the pizza with its toppings. Make it look appetizing with clear edges.`
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          modalities: ["image", "text"]
        }),
      });

      const sliceStatusCode = sliceResponse.status;

      if (!sliceResponse.ok) {
        const errorText = await sliceResponse.text();
        console.error(`[AI LOG] Failed to generate slice ${sliceNumber}:`, sliceStatusCode, errorText);
        sliceErrors.push(`Slice ${sliceNumber}: ${sliceStatusCode}`);
        
        await logApiCall(supabase, {
          companyId,
          userId,
          provider: aiProvider,
          endpoint: apiEndpoint,
          requestType: `slice-pizza-generate-${sliceNumber}`,
          status: "error",
          statusCode: sliceStatusCode,
          requestPayload: { model: imageModel, sliceNumber, detectedSlices },
          responseData: { errorText },
          errorMessage: `Slice ${sliceNumber} generation failed`,
          durationMs: Date.now() - sliceStartTime,
        });
        
        continue;
      }

      const sliceData = await sliceResponse.json();
      const sliceImageUrl = sliceData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (sliceImageUrl) {
        sliceImages.push(sliceImageUrl);
        console.log(`[AI LOG] Slice ${sliceNumber} generated successfully`);
        
        await logApiCall(supabase, {
          companyId,
          userId,
          provider: aiProvider,
          endpoint: apiEndpoint,
          requestType: `slice-pizza-generate-${sliceNumber}`,
          status: "success",
          statusCode: 200,
          requestPayload: { model: imageModel, sliceNumber, detectedSlices },
          responseData: { hasImage: true },
          durationMs: Date.now() - sliceStartTime,
        });
      } else {
        console.log(`[AI LOG] Slice ${sliceNumber} - no image URL in response`);
        sliceErrors.push(`Slice ${sliceNumber}: no image in response`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const totalDuration = Date.now() - startTime;
    
    // Log final result
    await logApiCall(supabase, {
      companyId,
      userId,
      provider: aiProvider,
      endpoint: apiEndpoint,
      requestType: "slice-pizza-complete",
      status: sliceImages.length > 0 ? "success" : "error",
      statusCode: 200,
      requestPayload: { numberOfSlices: sliceCount },
      responseData: { 
        detectedSlices, 
        generatedSlices: sliceImages.length,
        errors: sliceErrors.length > 0 ? sliceErrors : undefined
      },
      durationMs: totalDuration,
    });

    console.log(`[AI LOG] Complete - Generated ${sliceImages.length}/${detectedSlices} slices in ${totalDuration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        detectedSlices,
        sliceImages,
        message: `Generated ${sliceImages.length} pizza slice images`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI LOG] Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const status = errorMessage.includes("rate limit") ? 429 : 500;
    const totalDuration = Date.now() - startTime;
    
    // Log the error
    await logApiCall(supabase, {
      companyId: requestBody.companyId,
      userId: requestBody.userId,
      provider: aiProvider,
      requestType: "slice-pizza",
      status: "error",
      statusCode: status,
      requestPayload: { numberOfSlices: requestBody.numberOfSlices },
      errorMessage: errorMessage,
      durationMs: totalDuration,
    });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
