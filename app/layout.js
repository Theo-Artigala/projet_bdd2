import './globals.css';

export const metadata = {
  title: 'PumpOrDump',
  description: 'Jeu de trading sur tokens aléatoires',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
