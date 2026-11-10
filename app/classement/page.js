'use client';

import AppShell, { useSession } from '@/components/AppShell';
import { usePoll, fmtMontant, fmtSigne, cls } from '@/lib/client';

export default function ClassementPage() {
  return (
    <AppShell>
      <Classement />
    </AppShell>
  );
}

function Classement() {
  const { user } = useSession();
  const { data } = usePoll('/api/stats', 3000);
  if (!data) return null;

  return (
    <main className="page">
      <h1>Classement des joueurs</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Joueur</th>
              <th className="right">PnL réalisé</th><th className="right">Trades</th>
              <th className="right">Réussite</th><th className="right">Solde</th>
            </tr>
          </thead>
          <tbody>
            {data.classement.map((j, i) => (
              <tr key={j.utilisateur_id} style={j.utilisateur_id === user.id ? { background: 'var(--panel-2)' } : undefined}>
                <td className="muted">{i + 1}</td>
                <td><b>{j.pseudo}</b>{j.utilisateur_id === user.id && <span className="muted"> (toi)</span>}</td>
                <td className={'right num ' + cls(j.pnl_total)}>{fmtSigne(j.pnl_total)}</td>
                <td className="right num">{j.nb_trades}</td>
                <td className="right num">{j.taux_reussite == null ? '—' : Math.round(j.taux_reussite * 100) + ' %'}</td>
                <td className="right num">{fmtMontant(j.solde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Statistiques par token</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th className="right">Volume échangé</th><th className="right">Positions</th>
              <th className="right">Ouvertes</th><th className="right">Volatilité observée</th>
            </tr>
          </thead>
          <tbody>
            {data.tokens.map((t) => (
              <tr key={t.token_id}>
                <td><b>{t.symbole}</b></td>
                <td className="right num">{fmtMontant(t.volume)}</td>
                <td className="right num">{t.nb_positions}</td>
                <td className="right num">{t.positions_ouvertes}</td>
                <td className="right num">{(t.volatilite_observee * 100).toFixed(2)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
