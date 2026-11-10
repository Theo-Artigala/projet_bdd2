'use client';

import { Fragment, useState } from 'react';
import AppShell from '@/components/AppShell';
import { usePoll, fmtPrix, fmtMontant, fmtSigne, fmtPct, fmtDate, fmtQuantite, cls } from '@/lib/client';

export default function HistoriquePage() {
  return (
    <AppShell roles={['joueur']}>
      <Historique />
    </AppShell>
  );
}

const ORIGINE = { manuel: '', stop_loss: 'Stop Loss', take_profit: 'Take Profit', rug: 'Liquidation (rug) 💀' };

function Historique() {
  const { data } = usePoll('/api/positions?statut=fermee', 3000);
  const [ouvert, setOuvert] = useState(null);
  const positions = data || [];
  const total = positions.reduce((s, p) => s + p.pnl_realise, 0);
  const gagnantes = positions.filter((p) => p.pnl_realise > 0).length;

  return (
    <main className="page">
      <h1>Mon historique</h1>
      <div className="card" style={{ display: 'flex', gap: 32, padding: 16, marginBottom: 16 }}>
        <Stat label="PnL total" valeur={fmtSigne(total)} className={cls(total)} />
        <Stat label="Trades fermés" valeur={positions.length} />
        <Stat label="Réussite" valeur={positions.length ? Math.round((gagnantes / positions.length) * 100) + ' %' : '—'} />
      </div>
      <div className="card">
        {positions.length === 0 ? (
          <div className="empty">Aucune position fermée pour l&apos;instant.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Token</th><th>Ouverture</th><th>Fermeture</th>
                <th className="right">Ordres</th><th className="right">Prix moyen d&apos;achat</th>
                <th className="right">Investi</th><th className="right">Récupéré</th>
                <th className="right">Résultat</th><th className="right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => setOuvert(ouvert === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
                    <td><b>{p.symbole}</b> <span className="muted">{ouvert === p.id ? '▾' : '▸'}</span></td>
                    <td className="muted">{fmtDate(p.date_ouverture)}</td>
                    <td className="muted">{fmtDate(p.date_fermeture)}</td>
                    <td className="right num">{p.ordres.length}</td>
                    <td className="right num">{fmtPrix(p.prix_moyen_achat)}</td>
                    <td className="right num">{fmtMontant(p.total_investi)}</td>
                    <td className="right num">{fmtMontant(p.total_recupere)}</td>
                    <td className={'right num ' + cls(p.pnl_realise)}>{fmtPct(p.pnl_realise / p.total_investi)}</td>
                    <td className={'right num ' + cls(p.pnl_realise)}>{fmtSigne(p.pnl_realise)}</td>
                  </tr>
                  {ouvert === p.id &&
                    p.ordres.map((o) => (
                      <tr key={o.id} className="sub-row">
                        <td className={o.sens === 'achat' ? 'up' : 'down'}>
                          {o.sens === 'achat' ? 'Achat' : 'Vente'}
                          {ORIGINE[o.origine] && <span className="muted"> · {ORIGINE[o.origine]}</span>}
                        </td>
                        <td className="muted" colSpan={2}>{fmtDate(o.horodatage)}</td>
                        <td className="right num">{fmtQuantite(o.quantite)}</td>
                        <td className="right num">{fmtPrix(o.prix)}</td>
                        <td className="right num" colSpan={2}>{fmtMontant(o.montant)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Stat({ label, valeur, className = '' }) {
  return (
    <div>
      <div className="muted">{label}</div>
      <div className={'num ' + className} style={{ fontSize: 20, fontWeight: 700 }}>{valeur}</div>
    </div>
  );
}
