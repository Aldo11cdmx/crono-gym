# Variables de entorno para Vercel

Configura estas variables en Vercel (Project Settings > Environment Variables) para Production/Preview/Development según corresponda.

## Obligatorias
- `VITE_SUPABASE_URL` - URL del proyecto Supabase (pública)
- `VITE_SUPABASE_ANON_KEY` - Clave anon/public de Supabase (pública)

## Opcionales
- `VITE_EXERCISES_DATA_URL` - URL del dataset de ejercicios (ya tiene valor por defecto en `.env.local.example`)

## Notas
- Todas las variables con prefijo `VITE_` se inyectan en el bundle del cliente. NO añadas claves secretas con este prefijo.
- `COACH_JWT_SECRET` debe configurarse únicamente en Supabase Edge Functions (secrets), nunca en Vercel.
- Copia desde `.env.local.example` como referencia, sin copiar valores reales.
- Tras añadir variables en Vercel, vuelve a desplegar.

## Configuración de build
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install` (o usar lockfile)
- Node.js Version: `>=20.0.0` (ver `package.json` engines)
