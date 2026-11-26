import './globals.css';

export const metadata = {
  title: 'NOCTURNE: Beneath the Silent Facility | GamerKie',
  description: 'An original cinematic 2.5D side-scrolling puzzle adventure. Swim through a drowned passage, break a timber barricade, evade searchlights and escape the silent facility.',
  applicationName: 'NOCTURNE — GamerKie Edition',
};

export const viewport = {
  themeColor: '#081014',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
