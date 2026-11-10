'use client';

import { createContext, useContext, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, usePoll, fmtMontant } from '@/lib/client';

const SessionCtx = createContext(null);
export const useSession = () => useContext(SessionCtx);

const LIENS = [
  { href: '/trade', label: 'Trading', roles: ['joueur', 'admin', 'analyste'] },
  { href: '/historique', label: 'Historique', roles: ['joueur'] },
  { href: '/classement', label: 'Classement', roles: ['joueur', 'admin', 'analyste'] },
  { href: '/admin', label: 'Admin', roles: ['admin'] },
];

// Enveloppe des pages connectées : header + session partagée
export default function AppShell({ children, roles }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, refresh } = usePoll('/api/session', 2000);
  const user = data?.utilisateur;

  useEffect(() => {
    if (data && !user) router.replace('/');
    else if (user && roles && !roles.includes(user.role)) router.replace('/trade');
  }, [data, user, roles, router]);

  async function logout() {
    await api('/api/session', { method: 'DELETE' });
    router.replace('/');
  }

  if (!user || (roles && !roles.includes(user.role))) return null;

  return (
    <SessionCtx.Provider value={{ user, solde: data.solde, refresh }}>
      <header className="header">
        <Link href="/trade" className="logo">Pump<span>Or</span>Dump</Link>
        <nav className="nav">
          {LIENS.filter((l) => l.roles.includes(user.role)).map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-right">
          <span className="en-ligne"><span className="live-dot" />{data.en_ligne} en ligne</span>
          {data.solde != null && <span className="solde">{fmtMontant(data.solde)}</span>}
          <span>{user.pseudo}</span>
          <span className="role-badge">{user.role}</span>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </header>
      {children}
    </SessionCtx.Provider>
  );
}
