'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

// Connexion simulée : on choisit un utilisateur dans la liste
export default function Login() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/session').then((s) => s.utilisateur && router.replace('/trade')).catch(() => {});
    api('/api/users').then(setUsers).catch((e) => setError(e.message));
  }, [router]);

  async function connexion(id) {
    try {
      await api('/api/session', { method: 'POST', body: { userId: id } });
      router.push('/trade');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="login">
      <div className="card login-box">
        <div className="logo">Pump<span>Or</span>Dump</div>
        <p className="muted">Choisis un compte pour te connecter (connexion simulée, sans mot de passe).</p>
        <div className="user-list">
          {users.map((u) => (
            <button key={u.id} className="user-btn" onClick={() => connexion(u.id)}>
              <span>
                {u.pseudo}
                {u.bot && <span className="muted" style={{ fontSize: 12 }}> · bot</span>}
              </span>
              <span className="role-badge">{u.role}</span>
            </button>
          ))}
        </div>
        <div className="error-msg">{error}</div>
      </div>
    </main>
  );
}
