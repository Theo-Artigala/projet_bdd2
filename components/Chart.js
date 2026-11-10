'use client';

import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineStyle } from 'lightweight-charts';
import { fmtPrix } from '@/lib/client';

const VERT = '#2ebd85';
const ROUGE = '#f6465d';

/**
 * Graphique en chandeliers.
 * - bougies : [{time, open, high, low, close, volume}] (time en secondes)
 * - autres : ordres des autres joueurs → petits points (survol = pseudo)
 * - ath : prix le plus haut jamais atteint (ligne orange)
 * - positions : positions du joueur sur ce token → badges B (achat) et S (vente) pour chaque ordre
 * - ouverte : position ouverte → lignes prix moyen, stop loss, take profit
 * - onClicDroit({prix, x, y, largeur, hauteur}) : clic droit sur le graphique (coordonnées relatives)
 * Le composant est remonté (prop key) à chaque changement de token / d'intervalle.
 */
export default function Chart({ bougies, autres = [], ath, positions = [], ouverte, onClicDroit }) {
  const conteneur = useRef(null);
  const calque = useRef(null);
  const refs = useRef({ derniere: null, lignes: [], badges: [] });
  const clicDroitRef = useRef(onClicDroit);
  clicDroitRef.current = onClicDroit;

  // Création du graphique (une fois)
  useEffect(() => {
    const chart = createChart(conteneur.current, {
      autoSize: true,
      layout: {
        background: { color: '#0d0d0f' },
        textColor: '#8a8a93',
        fontFamily: 'ui-monospace, Consolas, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      rightPriceScale: { borderColor: '#26262c' },
      timeScale: {
        borderColor: '#26262c',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 8,
        barSpacing: 12,
      },
      crosshair: { mode: 0 },
      localization: { priceFormatter: fmtPrix },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: VERT,
      downColor: ROUGE,
      borderVisible: false,
      wickUpColor: VERT,
      wickDownColor: ROUGE,
      priceFormat: { type: 'custom', formatter: fmtPrix, minMove: 1e-8 },
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.22 } });

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    Object.assign(refs.current, { chart, candles, volume });

    // Clic droit → on convertit la position verticale de la souris en prix
    const el = conteneur.current;
    const surClicDroit = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const prix = candles.coordinateToPrice(y);
      if (prix != null && prix > 0) {
        clicDroitRef.current?.({ prix, x, y, largeur: rect.width, hauteur: rect.height });
      }
    };
    el.addEventListener('contextmenu', surClicDroit);

    // Boucle d'affichage des badges : on recalcule leur position à chaque frame
    // (zoom, défilement, nouvelle bougie, changement d'échelle)
    let raf;
    const placer = () => {
      for (const b of refs.current.badges) {
        const node = calque.current?.querySelector(`[data-badge="${b.cle}"]`);
        if (!node) continue;
        const x = chart.timeScale().timeToCoordinate(b.time);
        const y = candles.priceToCoordinate(b.prix);
        if (x == null || y == null) {
          node.style.display = 'none';
          continue;
        }
        node.style.display = 'block';
        node.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(placer);
    };
    raf = requestAnimationFrame(placer);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('contextmenu', surClicDroit);
      chart.remove();
    };
  }, []);

  // Données
  useEffect(() => {
    const r = refs.current;
    if (!r.chart || !bougies?.length) return;

    const versVolume = (b) => ({
      time: b.time,
      value: b.volume,
      color: b.close >= b.open ? 'rgba(46,189,133,0.45)' : 'rgba(246,70,93,0.45)',
    });

    if (r.derniere == null) {
      r.candles.setData(bougies);
      r.volume.setData(bougies.map(versVolume));
      r.chart.timeScale().scrollToRealTime();
    } else {
      // on ne pousse que les bougies nouvelles ou en cours
      for (const b of bougies) {
        if (b.time >= r.derniere) {
          r.candles.update(b);
          r.volume.update(versVolume(b));
        }
      }
    }
    r.derniere = bougies[bougies.length - 1].time;
  }, [bougies]);

  // Lignes horizontales : ATH, prix moyen, stop loss, take profit
  const prixMoyen = ouverte?.prix_moyen;
  const stopLoss = ouverte?.stop_loss;
  const takeProfit = ouverte?.take_profit;
  const libelle = (nom, pct) => (pct && pct < 100 ? nom + ' ' + pct + ' %' : nom);
  const titreSL = libelle('Stop Loss', ouverte?.stop_loss_pct);
  const titreTP = libelle('Take Profit', ouverte?.take_profit_pct);
  useEffect(() => {
    const r = refs.current;
    if (!r.candles) return;
    for (const l of r.lignes) r.candles.removePriceLine(l);
    r.lignes = [];
    const ligne = (price, color, title, lineStyle, lineWidth = 1) =>
      r.lignes.push(r.candles.createPriceLine({ price, color, title, lineStyle, lineWidth, axisLabelVisible: true }));

    if (ath) ligne(ath, '#f7a35c', 'All Time High', LineStyle.Dotted);
    if (prixMoyen) ligne(prixMoyen, VERT, 'Prix moyen', LineStyle.Dotted, 2);
    if (stopLoss) ligne(stopLoss, ROUGE, titreSL, LineStyle.Dashed, 2);
    if (takeProfit) ligne(takeProfit, '#4aa8ff', titreTP, LineStyle.Dashed, 2);
  }, [ath, prixMoyen, stopLoss, takeProfit, titreSL, titreTP]);

  // Badges : d'abord les points des autres (dessous), puis mes badges B / S (dessus)
  const intervalle = bougies?.length > 1 ? bougies[1].time - bougies[0].time : 5;
  const bucket = (ms) => Math.floor(ms / 1000 / intervalle) * intervalle;
  const badges = [];
  for (const o of autres) {
    badges.push({
      cle: 'a' + o.id,
      type: 'autre',
      sens: o.sens,
      lettre: (o.pseudo[0] || '?').toUpperCase(),
      titre: o.pseudo + ' · ' + (o.sens === 'achat' ? 'achète' : 'vend') + ' ' + o.montant.toFixed(2) + ' $',
      time: bucket(o.horodatage),
      prix: o.prix,
    });
  }
  for (const p of positions) {
    for (const o of p.ordres || []) {
      badges.push({
        cle: 'o' + o.id,
        type: o.sens === 'achat' ? 'B' : 'S',
        auto: o.origine !== 'manuel',
        time: bucket(o.horodatage),
        prix: o.prix,
      });
    }
  }
  refs.current.badges = badges;

  return (
    <>
      <div ref={conteneur} style={{ position: 'absolute', inset: 0 }} />
      <div ref={calque} className="badges">
        {badges.map((b) =>
          b.type === 'autre' ? (
            <div key={b.cle} data-badge={b.cle} className={'badge badge-autre ' + b.sens} style={{ display: 'none' }}>
              <span title={b.titre}>{b.lettre}</span>
            </div>
          ) : (
            <div key={b.cle} data-badge={b.cle} className={'badge badge-' + b.type} style={{ display: 'none' }}>
              <span title={b.auto ? 'Vente automatique (SL / TP)' : undefined}>{b.type}</span>
            </div>
          )
        )}
      </div>
    </>
  );
}
