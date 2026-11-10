'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

// Connexion : un visiteur choisit un pseudo ; l'hôte (sur sa machine) peut aussi
// reprendre un compte existant (admin, analyste, joueurs).
export default function Login() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/session')
      .then((s) => {
        if (s.utilisateur) return router.replace('/trade');
        setSession(s);
        if (s.local) api('/api/users').then(setUsers).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [router]);

  async function connexion(body) {
    setBusy(true);
    setError('');
    try {
      await api('/api/session', { method: 'POST', body });
      router.push('/trade');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  function rejoindre(e) {
    e.preventDefault();
    connexion({ pseudo });
  }

  return (
    <main className="login">
      <div className="card login-box">
        <div className="logo">Pump<span>Or</span>Dump</div>
        <p className="muted">
          Des tokens au prix complètement aléatoire. Achète, revends quand tu veux, et grimpe au classement.
          Chaque joueur commence avec <b style={{ color: 'var(--text)' }}>1 000 $</b>.
        </p>
        {session && (
          <p className="muted" style={{ fontSize: 13 }}>
            <span className="live-dot" /> {session.en_ligne} joueur{session.en_ligne > 1 ? 's' : ''} en ligne
          </p>
        )}

        <form onSubmit={rejoindre} style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <label className="muted" style={{ fontSize: 12 }}>Ton pseudo</label>
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="ex : diamond_hands"
            maxLength={20}
            autoFocus
          />
          <button className="btn-buy" style={{ marginTop: 4 }} disabled={busy || pseudo.trim().length < 3}>
            REJOINDRE LA PARTIE
          </button>
        </form>
        <div className="error-msg">{error}</div>

        {session?.local && users.length > 0 && (
          <>
            <div className="host-sep">Mode hôte · reprendre un compte</div>
            <div className="user-list">
              {users.map((u) => (
                <button key={u.id} className="user-btn" disabled={busy} onClick={() => connexion({ userId: u.id })}>
                  <span>
                    {u.pseudo}
                    {u.bot && <span className="muted" style={{ fontSize: 12 }}> · bot</span>}
                  </span>
                  <span className="role-badge">{u.role}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
