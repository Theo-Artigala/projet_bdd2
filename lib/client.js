'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Appel API côté navigateur ; lève une erreur avec le message du serveur
export async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Récupère une URL en boucle toutes les `ms` millisecondes
export function usePoll(url, ms = 1000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const refresh = useCallback(async () => {
    if (!urlRef.current) return;
    try {
      const d = await api(urlRef.current);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    setData(null);
    if (!url) return;
    refresh();
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [url, ms, refresh]);

  return { data, error, refresh };
}

// ----- Formatage -----
export function fmtPrix(p) {
  if (p == null) return '—';
  if (p >= 1e6) return (p / 1e6).toFixed(2) + 'M';
  if (p >= 1e4) return (p / 1e3).toFixed(2) + 'K';
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toPrecision(4);
}

export function fmtMontant(x) {
  if (x == null) return '—';
  return x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}

export function fmtSigne(x) {
  if (x == null) return '—';
  return (x >= 0 ? '+' : '') + fmtMontant(x);
}

export function fmtPct(x) {
  if (x == null) return '—';
  return (x >= 0 ? '+' : '') + (x * 100).toFixed(2) + ' %';
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

export const cls = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : '');

export function pnlLatent(position, prix) {
  if (prix == null) return null;
  return position.mise * (prix / position.prix_entree - 1);
}
