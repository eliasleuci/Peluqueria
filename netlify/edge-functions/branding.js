// Branding por cliente para PWA. Intercepta /p/<slug> y /p/<slug>/manifest.webmanifest.
// - Manifest: JSON dinámico con el nombre y el logo del salón (para Android).
// - HTML: inyecta apple-touch-icon + <link manifest> en el <head> (para iOS),
//   tomados del logo de ese salón según el slug.
// Lee el branding desde la vista pública salon_branding con la anon key (no secreta).

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function iconType(url) {
  return /\.jpe?g(\?|$)/i.test(url) ? 'image/jpeg' : 'image/png';
}

async function fetchBranding(slug) {
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!base || !key) return null;
  try {
    const r = await fetch(
      `${base}/rest/v1/salon_branding?slug=eq.${encodeURIComponent(slug)}&select=nombre,logo_url`,
      { headers: { apikey: key, authorization: `Bearer ${key}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch {
    return null;
  }
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['p', '<slug>', ...]
  const slug = parts[1];
  const isManifest = url.pathname.endsWith('/manifest.webmanifest');

  if (!slug) return context.next();

  const branding = await fetchBranding(slug);
  const nombre = branding?.nombre || 'MiPeluquería';
  const logo = branding?.logo_url || null;

  if (isManifest) {
    const manifest = {
      name: nombre,
      short_name: nombre.slice(0, 12),
      start_url: `/p/${slug}`,
      scope: '/',
      display: 'standalone',
      background_color: '#f4ede1',
      theme_color: '#b3382c',
      icons: logo
        ? [
            { src: logo, sizes: '192x192', type: iconType(logo), purpose: 'any' },
            { src: logo, sizes: '512x512', type: iconType(logo), purpose: 'any maskable' },
          ]
        : [],
    };
    return new Response(JSON.stringify(manifest), {
      headers: {
        'content-type': 'application/manifest+json; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  }

  // Traemos el index.html estático y reescribimos el <head>.
  const res = await context.next();
  const html = await res.text();

  const inject =
    [
      logo ? `<link rel="apple-touch-icon" href="${escapeHtml(logo)}">` : '',
      `<link rel="manifest" href="/p/${escapeHtml(slug)}/manifest.webmanifest">`,
      `<meta name="apple-mobile-web-app-capable" content="yes">`,
      `<meta name="mobile-web-app-capable" content="yes">`,
      `<meta name="apple-mobile-web-app-title" content="${escapeHtml(nombre)}">`,
      `<meta name="theme-color" content="#b3382c">`,
    ]
      .filter(Boolean)
      .join('\n    ') + '\n  ';

  let out = html.replace('</head>', `  ${inject}</head>`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(nombre)}</title>`);

  // Preservamos status y headers originales (cache, seguridad); solo reescribimos el body,
  // por eso quitamos content-length/encoding que ya no corresponden.
  const headers = new Headers(res.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(out, { status: res.status, headers });
}

export const config = { path: '/p/*' };
