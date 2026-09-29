import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'brandingSlug';

function readSlug() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSlug(slug) {
  try {
    localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // almacenamiento no disponible (modo privado): el branding igual sale del salón logueado
  }
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

function upsertMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Mantiene en el <head> el logo y el manifest del salón en CUALQUIER página, no solo en /p/<slug>.
// Así, si la página se recarga (p. ej. estando en /dashboard) y el usuario la "agrega a inicio",
// el ícono sigue siendo el del cliente. Fuente: salón logueado; si no hay sesión, el último
// /p/<slug> visitado en este dispositivo.
export default function BrandingSync() {
  const { salon } = useAuth();
  const location = useLocation();
  const [publico, setPublico] = useState(null); // { slug, nombre, logoUrl } sin sesión

  // Recordar el slug del link de instalación.
  const match = /^\/p\/([^/]+)/.exec(location.pathname);
  const slugDeUrl = match ? decodeURIComponent(match[1]) : null;
  if (slugDeUrl) saveSlug(slugDeUrl);

  const slugGuardado = slugDeUrl ?? readSlug();

  useEffect(() => {
    if (salon || !slugGuardado) return;
    let activo = true;
    supabase
      .from('salon_branding')
      .select('nombre, logo_url')
      .eq('slug', slugGuardado)
      .maybeSingle()
      .then(({ data }) => {
        if (activo && data) setPublico({ slug: slugGuardado, nombre: data.nombre, logoUrl: data.logo_url });
      });
    return () => {
      activo = false;
    };
  }, [salon, slugGuardado]);

  const branding = salon?.slug ? { slug: salon.slug, nombre: salon.nombre, logoUrl: salon.logoUrl } : publico;

  useEffect(() => {
    if (!branding?.slug) return;
    if (salon?.slug) saveSlug(salon.slug);
    if (branding.logoUrl) upsertLink('apple-touch-icon', branding.logoUrl);
    upsertLink('manifest', `/p/${encodeURIComponent(branding.slug)}/manifest.webmanifest`);
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', branding.nombre);
    document.title = branding.nombre;
  }, [branding?.slug, branding?.logoUrl, branding?.nombre, salon?.slug]);

  return null;
}
