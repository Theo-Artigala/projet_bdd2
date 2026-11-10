'use client';

import { useMemo, useState } from 'react';
import AppShell, { useSession } from '@/components/AppShell';
import Chart from '@/components/Chart';
import { api, usePoll, fmtPrix, fmtMontant, fmtSigne, fmtPct, cls, pnlLatent } from '@/lib/client';

const INTERVALLES = [
  { v: 1, label: '1s' },
  { v: 5, label: '5s' },
  { v: 15, label: '15s' },
  { v: 60, label: '1m' },
];

export default function TradePage() {
  return (
    <AppShell>
      <Trade />
    </AppShell>
  );
}

function Trade() {
  const { user } = useSession();
  const joueur = user.role === 'joueur';
  const [tokenId, setTokenId] = useState(null);
  const [intervalle, setIntervalle] = useState(5);

  const { data: tokens } = usePoll('/api/tokens', 1000);
  const idActif = tokenId ?? tokens?.[0]?.id ?? null;
  const token = tokens?.find((t) => t.id === idActif);
  const { data: bougies } = usePoll(idActif ? `/api/tokens/${idActif}/candles?interval=${intervalle}` : null, 1000);
  const { data: positions, refresh: refreshPositions } = usePoll(joueur ? '/api/positions' : null, 1500);

  const prixParToken = useMemo(() => Object.fromEntries((tokens || []).map((t) => [t.id, t.prix])), [tokens]);
  const ouvertes = (positions || []).filter((p) => p.statut === 'ouverte');
  const positionsToken = useMemo(() => (positions || []).filter((p) => p.token_id === idActif), [positions, idActif]);

  return (
    <div className="trade">
      <aside className="tokens">
        {(tokens || []).map((t) => (
          <div key={t.id} className={'token-row' + (t.id === idActif ? ' active' : '')} onClick={() => setTokenId(t.id)}>
            <div>
              <span className="sym">{t.symbole}</span>
              {t.statut === 'suspendu' && <span className="tag-susp">SUSPENDU</span>}
            </div>
            <div className="px num">{fmtPrix(t.prix)}</div>
            <div className="name">{t.nom}</div>
            <div className={'chg num ' + cls(t.variation)}>{fmtPct(t.variation)}</div>
          </div>
        ))}
      </aside>

      <section className="center">
        {token && (
          <div className="chart-head">
            <span className="sym">{token.symbole}</span>
            <span className="muted">{token.nom}</span>
            <span className={'big num ' + cls(token.variation)}>{fmtPrix(token.prix)}</span>
            <span className={'num ' + cls(token.variation)}>
              {fmtPct(token.variation)} <span className="muted">5 min</span>
            </span>
            <span className="muted">
              ATH <span className="num" style={{ color: 'var(--ath)' }}>{fmtPrix(token.ath)}</span>
            </span>
            <div className="intervals">
              {INTERVALLES.map((i) => (
                <button key={i.v} className={i.v === intervalle ? 'active' : ''} onClick={() => setIntervalle(i.v)}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="chart-wrap">
          <Chart bougies={bougies} ath={token?.ath} positions={positionsToken} resetKey={`${idActif}-${intervalle}`} />
        </div>
        {joueur && (
          <div className="positions-dock">
            <h3>Mes positions ouvertes ({ouvertes.length})</h3>
            <PositionsOuvertes positions={ouvertes} prix={prixParToken} onChange={refreshPositions} />
          </div>
        )}
      </section>

      <aside className="side">
        {joueur ? (
          token && (
            <PanneauTrade
              key={token.id}
              token={token}
              position={ouvertes.find((p) => p.token_id === token.id)}
              onChange={refreshPositions}
            />
          )
        ) : (
          <div className="card readonly">
            Mode lecture seule : seul un compte <b>joueur</b> peut trader.
          </div>
        )}
      </aside>
    </div>
  );
}

function PanneauTrade({ token, position, onChange }) {
  const { solde, refresh } = useSession();
  const [mise, setMise] = useState('50');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function action(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await Promise.all([onChange(), refresh()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const entrer = () =>
    action(() => api('/api/positions', { method: 'POST', body: { tokenId: token.id, mise: Number(mise) } }));
  const sortir = () => action(() => api(`/api/positions/${position.id}/close`, { method: 'POST' }));

  if (position) {
    const pnl = pnlLatent(position, token.prix);
    return (
      <div>
        <h3>Position ouverte · {token.symbole}</h3>
        <div className="card" style={{ padding: 14 }}>
          <div className={'pnl-big num ' + cls(pnl)}>{fmtSigne(pnl)}</div>
          <div className={'num ' + cls(pnl)} style={{ textAlign: 'center', marginBottom: 10 }}>
            {fmtPct(token.prix / position.prix_entree - 1)}
          </div>
          <div className="kv"><span className="k">Mise</span><span className="num">{fmtMontant(position.mise)}</span></div>
          <div className="kv"><span className="k">Prix d&apos;entrée</span><span className="num">{fmtPrix(position.prix_entree)}</span></div>
          <div className="kv"><span className="k">Prix actuel</span><span className="num">{fmtPrix(token.prix)}</span></div>
          <div className="kv"><span className="k">Valeur</span><span className="num">{fmtMontant(position.mise + pnl)}</span></div>
          <button className="btn-sell" disabled={busy} onClick={sortir}>SORTIR</button>
          <div className="error-msg">{error}</div>
        </div>
      </div>
    );
  }

  const suspendu = token.statut !== 'actif';
  return (
    <div>
      <h3>Entrer sur {token.symbole}</h3>
      <div className="card" style={{ padding: 14 }}>
        <label className="muted" style={{ fontSize: 12 }}>Mise ($)</label>
        <input
          className="num"
          type="number"
          min="1"
          step="1"
          value={mise}
          onChange={(e) => setMise(e.target.value)}
          style={{ marginTop: 4 }}
        />
        <div className="quick">
          {[0.1, 0.25, 0.5, 1].map((f) => (
            <button key={f} onClick={() => setMise(String(Math.floor((solde || 0) * f * 100) / 100))}>
              {f === 1 ? 'MAX' : f * 100 + '%'}
            </button>
          ))}
        </div>
        <div className="kv" style={{ marginTop: 10 }}>
          <span className="k">Solde dispo</span><span className="num">{fmtMontant(solde)}</span>
        </div>
        <div className="kv"><span className="k">Prix actuel</span><span className="num">{fmtPrix(token.prix)}</span></div>
        <button className="btn-buy" disabled={busy || suspendu} onClick={entrer}>
          {suspendu ? 'TOKEN SUSPENDU' : 'ENTRER'}
        </button>
        <div className="error-msg">{error}</div>
      </div>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Les prix d&apos;entrée et de sortie sont fixés par le serveur au moment du clic.
        Gain = mise × (prix sortie / prix entrée − 1).
      </p>
    </div>
  );
}

function PositionsOuvertes({ positions, prix, onChange }) {
  const { refresh } = useSession();
  if (!positions.length) return <div className="empty">Aucune position ouverte.</div>;

  async function fermer(id) {
    try {
      await api(`/api/positions/${id}/close`, { method: 'POST' });
    } finally {
      await Promise.all([onChange(), refresh()]);
    }
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th className="right">Mise</th>
          <th className="right">Entrée</th>
          <th className="right">Actuel</th>
          <th className="right">PnL</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const pnl = pnlLatent(p, prix[p.token_id]);
          return (
            <tr key={p.id}>
              <td><b>{p.symbole}</b></td>
              <td className="right num">{fmtMontant(p.mise)}</td>
              <td className="right num">{fmtPrix(p.prix_entree)}</td>
              <td className="right num">{fmtPrix(prix[p.token_id])}</td>
              <td className={'right num ' + cls(pnl)}>{fmtSigne(pnl)}</td>
              <td className="right"><button onClick={() => fermer(p.id)}>Sortir</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
