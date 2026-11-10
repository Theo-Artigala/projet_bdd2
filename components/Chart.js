'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  createSeriesMarkers,
} from 'lightweight-charts';
import { fmtPrix } from '@/lib/client';

const VERT = '#2ebd85';
const ROUGE = '#f6465d';

/**
 * Graphique en chandeliers.
 * - bougies : [{time, open, high, low, close, volume}] (time en secondes)
 * - ath : prix le plus haut jamais atteint (ligne orange)
 * - positions : positions du joueur sur ce token (marqueurs IN / OUT + ligne d'entrée)
 * - resetKey : change quand on change de token / d'intervalle → on recadre
 */
export default function Chart({ bougies, ath, positions = [], resetKey }) {
  const conteneur = useRef(null);
  const refs = useRef({});

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
      timeScale: { borderColor: '#26262c', timeVisible: true, secondsVisible: true, rightOffset: 6 },
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
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.22 } });

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const markers = createSeriesMarkers(candles, []);
    refs.current = { chart, candles, volume, markers, lignes: [], derniere: null, cle: null };
    return () => chart.remove();
  }, []);

  // Mise à jour des données
  useEffect(() => {
    const r = refs.current;
    if (!r.chart || !bougies?.length) return;

    const versVolume = (b) => ({
      time: b.time,
      value: b.volume,
      color: b.close >= b.open ? 'rgba(46,189,133,0.45)' : 'rgba(246,70,93,0.45)',
    });

    if (r.cle !== resetKey || r.derniere == null) {
      // changement de token / intervalle : on recharge tout
      r.candles.setData(bougies);
      r.volume.setData(bougies.map(versVolume));
      r.chart.timeScale().scrollToRealTime();
      r.cle = resetKey;
    } else {
      // sinon on ne pousse que les bougies nouvelles ou en cours
      for (const b of bougies) {
        if (b.time >= r.derniere) {
          r.candles.update(b);
          r.volume.update(versVolume(b));
        }
      }
    }
    r.derniere = bougies[bougies.length - 1].time;
  }, [bougies, resetKey]);

  // Lignes horizontales (ATH + prix d'entrée) et marqueurs
  useEffect(() => {
    const r = refs.current;
    if (!r.chart || !bougies?.length) return;
    for (const l of r.lignes) r.candles.removePriceLine(l);
    r.lignes = [];

    if (ath) {
      r.lignes.push(
        r.candles.createPriceLine({
          price: ath,
          color: '#f7a35c',
          lineStyle: LineStyle.Dotted,
          lineWidth: 1,
          axisLabelVisible: true,
          title: 'All Time High',
        })
      );
    }
    const ouverte = positions.find((p) => p.statut === 'ouverte');
    if (ouverte) {
      r.lignes.push(
        r.candles.createPriceLine({
          price: ouverte.prix_entree,
          color: '#8b7bff',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: 'Mon entrée',
        })
      );
    }

    // marqueurs sur les bougies visibles
    const intervalle = bougies.length > 1 ? bougies[1].time - bougies[0].time : 5;
    const debut = bougies[0].time;
    const bucket = (ms) => Math.floor(ms / 1000 / intervalle) * intervalle;
    const liste = [];
    for (const p of positions) {
      const te = bucket(p.date_entree);
      if (te >= debut) liste.push({ time: te, position: 'belowBar', color: VERT, shape: 'arrowUp', text: 'IN' });
      if (p.date_sortie) {
        const ts = bucket(p.date_sortie);
        if (ts >= debut)
          liste.push({ time: ts, position: 'aboveBar', color: p.pnl >= 0 ? VERT : ROUGE, shape: 'arrowDown', text: 'OUT' });
      }
    }
    liste.sort((a, b) => a.time - b.time);
    r.markers.setMarkers(liste);
  }, [bougies, ath, positions]);

  return <div ref={conteneur} style={{ position: 'absolute', inset: 0 }} />;
}
