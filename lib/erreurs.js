// Erreur "métier" : un refus prévu par les règles (solde insuffisant, droit refusé...).
// Elle est renvoyée au navigateur avec son message et affichée à l'utilisateur.
// Avec PostgreSQL, les RAISE EXCEPTION des triggers / procédures seront convertis en BusinessError.
export class BusinessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
