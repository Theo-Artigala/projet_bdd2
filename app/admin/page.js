'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, usePoll, fmtPrix, fmtMontant, fmtSigne, fmtDate, fmtQuantite, cls, pnlLatent, valeurPosition } from '@/lib/client';

export default function AdminPage() {
  return (
    <AppShell roles={['admin']}>
      <Admin />
    </AppShell>
  );
}

const VIDE = { nom: '', symbole: '', volatilite: '0.02', prix: '1' };

function Admin() {
  const { data: tokens, refresh } = usePoll('/api/tokens', 2000);
  const { data: positions } = usePoll('/api/admin/positions', 2000);
  const [form, setForm] = useState(VIDE);
  const [error, setError] = useState('');
  const prix = Object.fromEntries((tokens || []).map((t) => [t.id, t.prix]));

  async function creer(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/admin/tokens', { method: 'POST', body: form });
      setForm(VIDE);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function modifier(id, body) {
    setError('');
    try {
      await api(`/api/admin/tokens/${id}`, { method: 'PATCH', body });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const champ = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <main className="page">
      <h1>Administration</h1>

      <h2>Créer un token</h2>
      <form className="card form-row" onSubmit={creer}>
        <label>Nom<input {...champ('nom')} placeholder="Ex : Laser Frog" /></label>
        <label>Symbole<input {...champ('symbole')} placeholder="FROG" /></label>
        <label>Volatilité / tick<input {...champ('volatilite')} type="number" step="0.001" /></label>
        <label>Prix initial<input {...champ('prix')} type="number" step="any" /></label>
        <button type="submit">Créer</button>
      </form>
      <div className="error-msg">{error}</div>

      <h2>Tokens</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Symbole</th><th>Nom</th><th className="right">Prix</th>
              <th>Volatilité</th><th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(tokens || [])
              .slice()
              .sort((a, b) => (a.statut === 'mort') - (b.statut === 'mort'))
              .map((t) => (
              <tr key={t.id} className={t.statut === 'mort' ? 'muted' : ''}>
                <td><b>{t.symbole}</b></td>
                <td>{t.nom}</td>
                <td className="right num">{fmtPrix(t.prix)}</td>
                <td>
                  <input
                    className="vol-input num"
                    type="number"
                    step="0.001"
                    defaultValue={t.volatilite}
                    disabled={t.statut === 'mort'}
                    onBlur={(e) =>
                      Number(e.target.value) !== t.volatilite && modifier(t.id, { volatilite: e.target.value })
                    }
                  />
                </td>
                <td className={t.statut === 'actif' ? 'up' : 'down'}>
                  {t.statut === 'mort' ? '💀 mort' : t.statut}
                  {t.phase && t.statut !== 'mort' && <span className="muted"> · {t.phase}</span>}
                </td>
                <td className="right">
                  {t.statut !== 'mort' && (
                    <button onClick={() => modifier(t.id, { statut: t.statut === 'actif' ? 'suspendu' : 'actif' })}>
                      {t.statut === 'actif' ? 'Suspendre' : 'Réactiver'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Positions ouvertes (tous joueurs)</h2>
      <div className="card">
        {!positions?.length ? (
          <div className="empty">Aucune position ouverte.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Joueur</th><th>Token</th><th>Ouverte le</th>
                <th className="right">Quantité</th><th className="right">Prix moyen</th><th className="right">Valeur</th><th className="right">PnL latent</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const pnl = pnlLatent(p, prix[p.token_id]);
                return (
                  <tr key={p.id}>
                    <td>{p.pseudo}</td>
                    <td><b>{p.symbole}</b></td>
                    <td className="muted">{fmtDate(p.date_ouverture)}</td>
                    <td className="right num">{fmtQuantite(p.quantite)}</td>
                    <td className="right num">{fmtPrix(p.prix_moyen)}</td>
                    <td className="right num">{fmtMontant(valeurPosition(p, prix[p.token_id]))}</td>
                    <td className={'right num ' + cls(pnl)}>{fmtSigne(pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
