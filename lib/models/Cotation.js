// Table cotation : un prix d'un token à un instant donné
export class Cotation {
  constructor(r) {
    this.id = r.id;
    this.token_id = r.token_id;
    this.prix = r.prix;
    this.volume = r.volume;             // $ échangés par le reste du marché pendant cette seconde
    this.horodatage = r.horodatage;
  }
}

// Bougie OHLC (résultat de la requête d'agrégation des cotations)
export class Bougie {
  constructor(r) {
    this.time = r.time;                 // début de la bougie, en secondes
    this.open = r.open;
    this.high = r.high;
    this.low = r.low;
    this.close = r.close;
    this.volume = r.volume;
  }
}
