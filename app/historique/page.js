'use client';

import AppShell from '@/components/AppShell';
import { usePoll, fmtPrix, fmtMontant, fmtSigne, fmtPct, fmtDate, cls } from '@/lib/client';

export default function HistoriquePage() {
  return (
    <AppShell roles={['joueur']}>
      <Historique />
    </AppShell>
  );
}

function Historique() {
  const { data } = usePoll('/api/positions?statut=fermee', 3000);
  const positions = data || [];
  const total = positions.reduce((s, p) => s + p.pnl, 0);
  const gagnants = positions.filter((p) => p.pnl > 0).length;

  return (
    <main className="page">
      <h1>Mon historique</h1>
      <div className="card" style={{ display: 'flex', gap: 32, padding: 16, marginBottom: 16 }}>
        <div><div className="muted">PnL total</div><div className={'num ' + cls(total)} style={{ fontSize: 20, fontWeight: 700 }}>{fmtSigne(total)}</div></div>
        <div><div className="muted">Trades</div><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{positions.length}</div></div>
        <div><div className="muted">Réussite</div><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{positions.length ? Math.round((gagnants / positions.length) * 100) + ' %' : '—'}</div></div>
      </div>
      <div className="card">
        {positions.length === 0 ? (
          <div className="empty">Aucune position fermée pour l'instant.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Token</th><th>Entrée</th><th>Sortie</th>
                <th className="right">Mise</th><th className="right">Prix entrée</th><th className="right">Prix sortie</th>
                <th className="right">Variation</th><th className="right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.symbole}</b></td>
                  <td className="muted">{fmtDate(p.date_entree)}</td>
                  <td className="muted">{fmtDate(p.date_sortie)}</td>
                  <td className="right num">{fmtMontant(p.mise)}</td>
                  <td className="right num">{fmtPrix(p.prix_entree)}</td>
                  <td className="right num">{fmtPrix(p.prix_sortie)}</td>
                  <td className={'right num ' + cls(p.pnl)}>{fmtPct(p.prix_sortie / p.prix_entree - 1)}</td>
                  <td className={'right num ' + cls(p.pnl)}>{fmtSigne(p.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
