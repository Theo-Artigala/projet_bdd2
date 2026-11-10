// Le serveur d'aperçu (npm run dev:preview) utilise son propre dossier de build
// pour ne pas entrer en conflit avec un `npm run dev` lancé en parallèle.
const preview = process.env.npm_lifecycle_event === 'dev:preview';

export default {
  distDir: preview ? '.next-preview' : '.next',
  // autorise l'accès au serveur de dev via un tunnel Cloudflare
  allowedDevOrigins: ['*.trycloudflare.com'],
};
