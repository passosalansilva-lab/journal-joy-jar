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

function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

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
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyColors(branding: CompanyBranding) {
  const root = document.documentElement;
  
  if (branding.primaryColor) {
    const primaryHsl = hexToHsl(branding.primaryColor);
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--ring', primaryHsl);
    root.style.setProperty('--sidebar-primary', primaryHsl);
    root.style.setProperty('--sidebar-ring', primaryHsl);
  }
  
  if (branding.secondaryColor) {
    const secondaryHsl = hexToHsl(branding.secondaryColor);
    root.style.setProperty('--secondary', secondaryHsl);
    root.style.setProperty('--accent', secondaryHsl);
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
        applyColors(companyBranding);
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
