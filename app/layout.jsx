import './globals.css';

export const metadata = {
  title: 'NOCTURNE: The Silent Facility | GamerKie',
  description: 'A cinematic atmospheric puzzle-platformer. Move through the silent facility, solve environmental puzzles and escape the darkness.',
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
