-- Adiciona a feature "comandas" à tabela system_features
-- Esta feature controla o acesso ao módulo de Comandas no sidebar

INSERT INTO system_features (key, name, description, icon, category, is_active)
VALUES (
  'comandas',
  'Comandas',
  'Sistema de comandas para controle de consumo por cliente/mesa',
  'Receipt',
  'Principal',
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category;
