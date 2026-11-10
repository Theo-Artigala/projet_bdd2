import { Dao } from './Dao';

/** Interface de lecture des indicateurs (futures vues matérialisées). */
export class StatsDao extends Dao {
  async classement() { this.nonImplemente('classement'); }
  async statsTokens() { this.nonImplemente('statsTokens'); }
}
