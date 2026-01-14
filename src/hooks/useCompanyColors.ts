import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyBranding {
  primaryColor: string;
  secondaryColor: string;
  logo: string | null;
  name: string | null;
}

const defaultBranding: CompanyBranding = {
  primaryColor: '#F97316', // Orange
  secondaryColor: '#FED7AA',
  logo: null,
  name: null,
};

type HslParts = { h: number; s: number; l: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseHexToHslParts(hex: string): HslParts | null {
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length !== 6) return null;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function toHslVar(parts: HslParts) {
  return `${parts.h} ${parts.s}% ${parts.l}%`;
}

function shift(parts: HslParts, opts: { h?: number; s?: number; l?: number }): HslParts {
  return {
    h: (parts.h + (opts.h ?? 0) + 360) % 360,
    s: clamp(parts.s + (opts.s ?? 0), 0, 100),
    l: clamp(parts.l + (opts.l ?? 0), 0, 100),
  };
}

export function applyCompanyBranding(input: Partial<CompanyBranding>) {
  const root = document.documentElement;

  const primaryParts = input.primaryColor ? parseHexToHslParts(input.primaryColor) : null;
  const secondaryParts = input.secondaryColor ? parseHexToHslParts(input.secondaryColor) : null;

  if (primaryParts) {
    const primaryVar = toHslVar(primaryParts);
    const primaryAlt = toHslVar(shift(primaryParts, { h: 14, l: 3 }));
    const heroAlt = toHslVar(shift(primaryParts, { h: -18, l: -2, s: 4 }));

    root.style.setProperty('--primary', primaryVar);
    root.style.setProperty('--ring', primaryVar);
    root.style.setProperty('--sidebar-primary', primaryVar);
    root.style.setProperty('--sidebar-ring', primaryVar);

    // Keep gradient tokens in sync (many screens use .gradient-primary)
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${primaryVar}) 0%, hsl(${primaryAlt}) 100%)`);
    root.style.setProperty('--gradient-hero', `linear-gradient(135deg, hsl(${primaryVar}) 0%, hsl(${heroAlt}) 100%)`);

    // Glow shadow based on primary
    root.style.setProperty('--shadow-glow', `0 0 32px hsl(${primaryVar} / 0.25)`);
  }

  if (secondaryParts) {
    const secondaryVar = toHslVar(secondaryParts);
    root.style.setProperty('--secondary', secondaryVar);
    root.style.setProperty('--accent', secondaryVar);
  }
}


export function useCompanyColors(companyId: string | null) {
  const [branding, setBranding] = useState<CompanyBranding>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const loadBranding = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('primary_color, secondary_color, logo_url, name')
        .eq('id', companyId)
        .maybeSingle();

      if (error) {
        console.error('Error loading company branding:', error);
        return;
      }

      if (data) {
        const companyBranding: CompanyBranding = {
          primaryColor: data.primary_color || defaultBranding.primaryColor,
          secondaryColor: data.secondary_color || defaultBranding.secondaryColor,
          logo: data.logo_url || null,
          name: data.name || null,
        };
        
        setBranding(companyBranding);
        applyCompanyBranding(companyBranding);
      }
    } catch (error) {
      console.error('Error loading company branding:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  // Legacy compatibility - expose colors object
  const colors = {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
  };

  return { colors, branding, loading };
}
