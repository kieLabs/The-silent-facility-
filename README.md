# NOCTURNE: The Silent Facility — GamerKie Original

An original atmospheric side-scrolling puzzle-platformer built with Next.js, React and Canvas 2D. It takes inspiration from the *mood* of cinematic puzzle-platformers (silhouette art, industrial spaces, environmental puzzles), while using an original world, character, layout and gameplay.

## Included gameplay

- Four connected areas: The Drowned Yard, The Watcher, The Broken Span and The Observation Wing.
- Push a metal crate onto a pressure plate to open the first passage.
- Stay crouched to slip beneath the moving searchlight.
- Jump across the flooded platform gap.
- Activate the control switch, open the final gate and reach the exit.
- Checkpoint respawn, pause/resume, restart, fullscreen, sound toggle and progress HUD.
- Keyboard and touch controls. Mobile play is designed for landscape orientation.
- No backend, API key, external game asset or paid library is required.

## Run locally

Requirements: Node.js 20.9 or newer (the GitHub workflow uses Node.js 22).

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests and production build

```bash
npm test
npm run build
```

The production build exports a static site into `out/`.

## Deploy to GitHub Pages

1. Create a new public GitHub repository (example: `nocturne-game`).
2. Upload the contents of this project to the repository root. Do not upload the outer ZIP folder as an extra nested folder.
3. Make sure the default branch is `main` (or `master`).
4. In GitHub, open **Settings → Pages** and set the source to **GitHub Actions**.
5. Open the **Actions** tab. The workflow named **Deploy Next.js game to GitHub Pages** will build and publish the game.
6. When it finishes, your game URL will be:

   `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/`

The workflow automatically sets the repository base path, so static assets resolve correctly on a project GitHub Pages URL.

## Embed in Blogger

1. Open `blogger/iframe-embed.html`.
2. Replace `YOUR-GITHUB-USERNAME` and `YOUR-REPOSITORY` in the iframe URL with your actual GitHub Pages details.
3. In Blogger, create or edit a post and switch the editor to **HTML view**.
4. Paste the complete embed snippet and publish.

For a Blogger post description, use:

> Explore the abandoned Silent Facility in NOCTURNE, a cinematic puzzle-platformer from GamerKie. Push objects, avoid the searchlight, cross broken platforms and find the way out.

Suggested Blogger labels: `Puzzle`, `Adventure`, `Platformer`, `Horror`, `GamerKie`.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or ← / → | Left / right buttons |
| Jump | Space / W / ↑ | Up button |
| Crouch | S / ↓ | Down button |
| Interact | E | E button |
| Restart at checkpoint | R | — |
| Pause / resume | Esc / P or top pause button | Top pause button |

## Project structure

```text
app/
  game/engine.js       Canvas game engine
  globals.css          Responsive dark game UI
  layout.jsx            Next.js metadata and root layout
  page.jsx              Game screen and touch controls
lib/
  physics.js            Deterministic collision helpers
tests/
  physics.test.js       Physics unit tests
blogger/
  iframe-embed.html     Blogger iframe embed snippet
.github/workflows/
  deploy.yml            GitHub Pages deployment
```

## Notes

- The exported static build is intended for GitHub Pages and iframe embedding.
- The game is an original homage to a genre and visual mood. It does not include original *INSIDE* game assets, music, characters, level maps or proprietary code.
