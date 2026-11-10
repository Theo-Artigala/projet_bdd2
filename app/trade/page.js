'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell, { useSession } from '@/components/AppShell';
import Chart from '@/components/Chart';
import {
  api,
  usePoll,
  fmtPrix,
  fmtMontant,
  fmtSigne,
  fmtPct,
  fmtQuantite,
  cls,
  pnlLatent,
  valeurPosition,
} from '@/lib/client';

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
  const { user, refresh: refreshSession } = useSession();
  const joueur = user.role === 'joueur';
  const [tokenId, setTokenId] = useState(null);
  const [intervalle, setIntervalle] = useState(5);
  const [menu, setMenu] = useState(null);       // menu du clic droit {prix, x, y}
  const [toast, setToast] = useState('');

  const { data: tokens } = usePoll('/api/tokens', 1000);
  const vivants = (tokens || []).filter((t) => t.statut !== 'mort');
  // cimetière : les 6 derniers tokens morts
  const morts = (tokens || []).filter((t) => t.statut === 'mort').sort((a, b) => b.date_mort - a.date_mort).slice(0, 6);
  const idActif = tokenId ?? vivants[0]?.id ?? null;
  const token = tokens?.find((t) => t.id === idActif);
  const { data: graphique } = usePoll(idActif ? `/api/tokens/${idActif}/candles?interval=${intervalle}` : null, 1000);
  const { data: positions, refresh: refreshPositions } = usePoll(joueur ? '/api/positions' : null, 1000);

  const prixParToken = useMemo(() => Object.fromEntries((tokens || []).map((t) => [t.id, t.prix])), [tokens]);
  const ouvertes = (positions || []).filter((p) => p.statut === 'ouverte');
  const positionsToken = useMemo(() => (positions || []).filter((p) => p.token_id === idActif), [positions, idActif]);
  const ouverte = ouvertes.find((p) => p.token_id === idActif);

  // le toast disparaît tout seul
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // fermeture du menu : clic ailleurs ou Échap
  useEffect(() => {
    if (!menu) return;
    const fermer = () => setMenu(null);
    const clavier = (e) => e.key === 'Escape' && fermer();
    window.addEventListener('click', fermer);
    window.addEventListener('keydown', clavier);
    return () => {
      window.removeEventListener('click', fermer);
      window.removeEventListener('keydown', clavier);
    };
  }, [menu]);

  async function rafraichir() {
    await Promise.all([refreshPositions(), refreshSession()]);
  }

  async function definirStops(champs) {
    setMenu(null);
    try {
      await api(`/api/positions/${ouverte.id}/stops`, { method: 'PATCH', body: champs });
      await refreshPositions();
    } catch (e) {
      setToast(e.message);
    }
  }

  return (
    <div className="trade">
      <aside className="tokens">
        <div className="token-list">
          {vivants.map((t) => (
            <LigneToken key={t.id} t={t} actif={t.id === idActif} onClick={() => setTokenId(t.id)} />
          ))}
          {morts.length > 0 && <div className="cimetiere">💀 Cimetière</div>}
          {morts.map((t) => (
            <LigneToken key={t.id} t={t} actif={t.id === idActif} onClick={() => setTokenId(t.id)} />
          ))}
        </div>
        <FilActivite moi={user.pseudo} />
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
            {token.phase && <span className={'phase phase-' + token.phase}>{PHASES[token.phase]}</span>}
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
          <Chart
            key={`${idActif}-${intervalle}`}
            bougies={graphique?.bougies}
            autres={graphique?.autres}
            ath={token?.ath}
            positions={positionsToken}
            ouverte={ouverte}
            onClicDroit={joueur ? setMenu : undefined}
          />
          {menu && token && (
            <MenuStops menu={menu} prixActuel={token.prix} ouverte={ouverte} onChoix={definirStops} />
          )}
          {toast && <div className="toast">{toast}</div>}
          {token?.statut === 'mort' && (
            <div className="rug-banner">
              💀 <b>{token.symbole}</b> s&apos;est fait rug à {new Date(token.date_mort).toLocaleTimeString('fr-FR')}.
              Les positions ont été liquidées.
            </div>
          )}
        </div>
        {joueur && (
          <div className="positions-dock">
            <h3>Mes positions ouvertes ({ouvertes.length})</h3>
            <PositionsOuvertes positions={ouvertes} prix={prixParToken} onChange={rafraichir} />
          </div>
        )}
      </section>

      <aside className="side">
        {joueur ? (
          token && <PanneauTrade key={token.id} token={token} position={ouverte} onChange={rafraichir} />
        ) : (
          <div className="card readonly">
            Mode lecture seule : seul un compte <b>joueur</b> peut trader.
          </div>
        )}
      </aside>
    </div>
  );
}

const PHASES = { calme: '😴 Calme', normal: 'Normal', frenesie: '🔥 Frénésie', rug: '💀 RUG EN COURS' };
const NOUVEAU_MS = 5 * 60 * 1000;

function LigneToken({ t, actif, onClick }) {
  const nouveau = t.statut !== 'mort' && Date.now() - t.date_creation < NOUVEAU_MS;
  return (
    <div className={'token-row' + (actif ? ' active' : '') + (t.statut === 'mort' ? ' mort' : '')} onClick={onClick}>
      <div>
        <span className="sym">{t.symbole}</span>
        {nouveau && <span className="tag-new">NEW</span>}
        {t.phase === 'frenesie' && <span title="Frénésie"> 🔥</span>}
        {t.phase === 'rug' && <span className="tag-rug">RUG</span>}
        {t.statut === 'suspendu' && <span className="tag-susp">SUSPENDU</span>}
      </div>
      <div className="px num">{fmtPrix(t.prix)}</div>
      <div className="name">{t.nom}</div>
      <div className={'chg num ' + (t.statut === 'mort' ? 'muted' : cls(t.variation))}>
        {t.statut === 'mort' ? 'mort' : fmtPct(t.variation)}
      </div>
    </div>
  );
}

// Fil d'activité : les derniers ordres de tous les joueurs
function FilActivite({ moi }) {
  const { data } = usePoll('/api/activity', 2000);
  const libelle = (a) => {
    if (a.origine === 'rug') return '💀 se fait liquider (rug) :';
    if (a.origine === 'stop_loss') return 'touche son Stop Loss sur';
    if (a.origine === 'take_profit') return 'prend son Take Profit sur';
    return a.sens === 'achat' ? 'achète' : 'vend';
  };
  return (
    <div className="feed">
      <h3><span className="live-dot" />En direct</h3>
      <ul>
        {(data || []).map((a) => (
          <li key={a.id}>
            <b className={a.pseudo === moi ? 'moi' : ''}>{a.pseudo}</b> {libelle(a)}{' '}
            <span className={a.sens === 'achat' ? 'up' : 'down'}>{fmtMontant(a.montant)}</span> de <b>{a.symbole}</b>
            <span className="t">{new Date(a.horodatage).toLocaleTimeString('fr-FR')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const POURCENTAGES = [25, 50, 75, 100];

// Menu du clic droit : placer / retirer stop loss et take profit au prix pointé,
// en choisissant le pourcentage de la position vendu au déclenchement
function MenuStops({ menu, prixActuel, ouverte, onChoix }) {
  const { prix, x, y, largeur, hauteur } = menu;
  const sousLePrix = prix < prixActuel;
  const [pct, setPct] = useState(100);
  // près d'un bord, le menu s'ouvre de l'autre côté du curseur pour rester visible
  const decalX = x > largeur - 280 ? '-100%' : '0';
  const decalY = y > hauteur - 220 ? '-100%' : '0';
  return (
    <div
      className="ctx-menu"
      style={{ left: x, top: y, transform: `translate(${decalX}, ${decalY})` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ctx-title num">{fmtPrix(prix)}</div>
      {!ouverte ? (
        <div className="ctx-item disabled">Achète d&apos;abord ce token pour placer un SL / TP</div>
      ) : (
        <>
          <div className="ctx-pct">
            <span className="muted">Vendre</span>
            {POURCENTAGES.map((p) => (
              <button key={p} className={p === pct ? 'active' : ''} onClick={() => setPct(p)}>
                {p === 100 ? 'tout' : p + ' %'}
              </button>
            ))}
          </div>
          {sousLePrix ? (
            <button className="ctx-item" onClick={() => onChoix({ stop_loss: prix, stop_loss_pct: pct })}>
              <span className="dot" style={{ background: 'var(--red)' }} />
              Stop Loss à <b className="num">{fmtPrix(prix)}</b>
              <span className="muted num">{fmtPct(prix / prixActuel - 1)}</span>
            </button>
          ) : (
            <button className="ctx-item" onClick={() => onChoix({ take_profit: prix, take_profit_pct: pct })}>
              <span className="dot" style={{ background: 'var(--blue)' }} />
              Take Profit à <b className="num">{fmtPrix(prix)}</b>
              <span className="muted num">{fmtPct(prix / prixActuel - 1)}</span>
            </button>
          )}
          {ouverte.stop_loss != null && (
            <button className="ctx-item" onClick={() => onChoix({ stop_loss: null })}>
              Retirer le Stop Loss
            </button>
          )}
          {ouverte.take_profit != null && (
            <button className="ctx-item" onClick={() => onChoix({ take_profit: null })}>
              Retirer le Take Profit
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PanneauTrade({ token, position, onChange }) {
  const { solde } = useSession();
  const [montant, setMontant] = useState('50');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function action(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const acheter = () =>
    action(() => api('/api/positions', { method: 'POST', body: { tokenId: token.id, montant: Number(montant) } }));
  const vendre = (pourcentage) =>
    action(() => api(`/api/positions/${position.id}/sell`, { method: 'POST', body: { pourcentage } }));
  const retirer = (champ) =>
    action(() => api(`/api/positions/${position.id}/stops`, { method: 'PATCH', body: { [champ]: null } }));

  const suspendu = token.statut !== 'actif';
  const libelleBloque = token.statut === 'mort' ? 'TOKEN MORT 💀' : 'TOKEN SUSPENDU';
  const valeur = position ? valeurPosition(position, token.prix) : null;
  const pnl = position ? pnlLatent(position, token.prix) : null;

  return (
    <>
      {position && (
        <div>
          <h3>Ma position · {token.symbole}</h3>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Valeur actuelle</div>
            <div className="pnl-big num">{fmtMontant(valeur)}</div>
            <div className={'num ' + cls(pnl)} style={{ textAlign: 'center', marginBottom: 10, fontWeight: 600 }}>
              {fmtSigne(pnl)} ({fmtPct(pnl / position.cout)})
            </div>
            <div className="kv"><span className="k">Quantité</span><span className="num">{fmtQuantite(position.quantite)}</span></div>
            <div className="kv"><span className="k">Prix moyen</span><span className="num">{fmtPrix(position.prix_moyen)}</span></div>
            <div className="kv"><span className="k">Investi (restant)</span><span className="num">{fmtMontant(position.cout)}</span></div>
            <div className="kv">
              <span className="k">PnL déjà réalisé</span>
              <span className={'num ' + cls(position.pnl_realise)}>{fmtSigne(position.pnl_realise)}</span>
            </div>
            <div className="kv">
              <span className="k">Stop Loss</span>
              <StopValeur valeur={position.stop_loss} pct={position.stop_loss_pct} couleur="var(--red)" onRetirer={() => retirer('stop_loss')} />
            </div>
            <div className="kv">
              <span className="k">Take Profit</span>
              <StopValeur valeur={position.take_profit} pct={position.take_profit_pct} couleur="var(--blue)" onRetirer={() => retirer('take_profit')} />
            </div>
            <p className="muted hint">Clic droit sur le graphique pour placer un SL / TP.</p>

            <div className="sell-grid">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} className="btn-sell-pct" disabled={busy || suspendu} onClick={() => vendre(p)}>
                  <b>Vendre {p === 100 ? 'tout' : p + ' %'}</b>
                  <span className="num">≈ {fmtMontant((valeur * p) / 100)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <h3>{position ? 'Racheter' : 'Acheter'} {token.symbole}</h3>
        <div className="card" style={{ padding: 14 }}>
          <label className="muted" style={{ fontSize: 12 }}>Montant ($)</label>
          <input
            className="num"
            type="number"
            min="1"
            step="1"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            style={{ marginTop: 4 }}
          />
          <div className="quick">
            {[0.1, 0.25, 0.5, 1].map((f) => (
              <button key={f} onClick={() => setMontant(String(Math.floor((solde || 0) * f * 100) / 100))}>
                {f === 1 ? 'MAX' : f * 100 + '%'}
              </button>
            ))}
          </div>
          <div className="kv" style={{ marginTop: 10 }}>
            <span className="k">Solde dispo</span><span className="num">{fmtMontant(solde)}</span>
          </div>
          <div className="kv"><span className="k">Prix actuel</span><span className="num">{fmtPrix(token.prix)}</span></div>
          <div className="kv">
            <span className="k">Tu reçois ≈</span>
            <span className="num">{fmtQuantite(Number(montant) / token.prix)} {token.symbole}</span>
          </div>
          <button className="btn-buy" disabled={busy || suspendu} onClick={acheter}>
            {suspendu ? libelleBloque : position ? 'RACHETER' : 'ACHETER'}
          </button>
        </div>
      </div>
      <div className="error-msg">{error}</div>
    </>
  );
}

function StopValeur({ valeur, pct, couleur, onRetirer }) {
  if (valeur == null) return <span className="muted">—</span>;
  return (
    <span className="num" style={{ color: couleur }}>
      {fmtPrix(valeur)}
      <span className="muted"> · {pct === 100 ? 'tout' : pct + ' %'}</span>
      <button className="btn-x" onClick={onRetirer} title="Retirer">×</button>
    </span>
  );
}

function PositionsOuvertes({ positions, prix, onChange }) {
  if (!positions.length) return <div className="empty">Aucune position ouverte.</div>;

  async function toutVendre(id) {
    try {
      await api(`/api/positions/${id}/sell`, { method: 'POST', body: { pourcentage: 100 } });
    } finally {
      await onChange();
    }
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th className="right">Quantité</th>
          <th className="right">Prix moyen</th>
          <th className="right">Actuel</th>
          <th className="right">Valeur</th>
          <th className="right">PnL latent</th>
          <th className="right">SL</th>
          <th className="right">TP</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const pnl = pnlLatent(p, prix[p.token_id]);
          return (
            <tr key={p.id}>
              <td><b>{p.symbole}</b></td>
              <td className="right num">{fmtQuantite(p.quantite)}</td>
              <td className="right num">{fmtPrix(p.prix_moyen)}</td>
              <td className="right num">{fmtPrix(prix[p.token_id])}</td>
              <td className="right num">{fmtMontant(valeurPosition(p, prix[p.token_id]))}</td>
              <td className={'right num ' + cls(pnl)}>{fmtSigne(pnl)}</td>
              <td className="right num down">{p.stop_loss != null ? fmtPrix(p.stop_loss) + (p.stop_loss_pct < 100 ? ' (' + p.stop_loss_pct + ' %)' : '') : <span className="muted">—</span>}</td>
              <td className="right num" style={{ color: 'var(--blue)' }}>
                {p.take_profit != null ? fmtPrix(p.take_profit) + (p.take_profit_pct < 100 ? ' (' + p.take_profit_pct + ' %)' : '') : <span className="muted">—</span>}
              </td>
              <td className="right"><button onClick={() => toutVendre(p.id)}>Tout vendre</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
