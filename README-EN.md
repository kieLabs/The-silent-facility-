# NOCTURNE: BENEATH THE SILENT FACILITY — GamerKie Original

An original cinematic 2.5D-style side-scrolling puzzle-platformer guided by the visual direction of the supplied reference frames: a cold underwater passage, a small red-jacketed protagonist, a boarded timber entrance, an industrial searchlight hall, a glass observation room, a broken elevated walkway, and a mist-filled final hall. The project does not copy a commercial game's characters, level maps, code, or assets.

## Features

- Underwater traversal with vertical swimming, bubbles, weeds, suspended silhouettes and light shafts.
- Hold-to-break interaction at a boarded timber barricade.
- Sweeping searchlight stealth section with crouch behavior.
- Glass observation room with interior equipment and distant silhouettes.
- Staggered broken platforms over a dark flooded shaft.
- Final release switch and misty doorway with a distant crowd silhouette.
- Camera follow, parallax industrial skyline, fog, dust, volumetric-style light cones, vignette and animated character silhouettes.
- Checkpoints, respawns, pause, restart, fullscreen, sound toggle and progress HUD.
- Keyboard and touch controls; landscape-oriented mobile layout.
- No backend, API key, paid assets or external game engine. Artwork is drawn procedurally using Canvas 2D.

## Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Move | A / D or ← / → | Left / Right |
| Swim up / Jump | Space / W / ↑ | ↑ button |
| Swim down / Crouch | S / ↓ | ↓ button |
| Break boards / Use switch | Hold E | Hold E button |
| Pause / Resume | Esc or P | Pause icon |
| Reset to checkpoint | R | Restart in pause menu |

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Test and build

```bash
npm test
npm run build
```

The static export is written to `out/`.

## Deploy to GitHub Pages

1. Create a public GitHub repository, for example `nocturne-game`.
2. Extract this ZIP and upload the contents of the extracted project folder to the repository root.
3. Make sure the hidden `.github/workflows/deploy.yml` file is uploaded. Some mobile file pickers hide hidden folders.
4. Keep the default branch named `main`.
5. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
6. Open the **Actions** tab and wait for both Build and Deploy jobs to complete successfully.
7. Your site URL will be:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/
```

The workflow sets the repository base path automatically. The package also includes `public/.nojekyll`.

## Embed in Blogger

1. Open `blogger/iframe-embed.html`.
2. Replace `YOUR-GITHUB-USERNAME` and `YOUR-REPOSITORY`.
3. In Blogger, switch the post editor to **HTML View**.
4. Paste the iframe snippet and publish.
5. Use `BLOGGER-SEO.txt` for a title and search description.

## Project layout

```text
app/game/engine.js          Canvas game engine
app/globals.css             Responsive styling
app/layout.jsx              Next.js metadata
app/page.jsx                Game screen, HUD and touch controls
lib/physics.js               Collision helpers
lib/level.js                  Level and gameplay rules
tests/physics.test.js        Physics tests
tests/level.test.js          Gameplay rule tests
tests/engine-smoke.test.js   End-to-end engine smoke test
blogger/iframe-embed.html    Blogger embed
.github/workflows/deploy.yml GitHub Pages deployment
public/.nojekyll             GitHub Pages static support
README.md                    Hindi guide
README-EN.md                 English guide
```

## Rendering note

This is a Canvas 2D game using procedural shapes, gradients, shadows, parallax, fog, light cones and animation to create a cinematic 2.5D presentation. It is not a full 3D model-based AAA renderer. The visual direction follows the supplied reference composition while using original artwork. The Next.js production build could not be run in this environment because npm registry installation timed out; GitHub Actions will perform the dependency installation and production build. Local automated tests and JavaScript syntax checks passed.

**GamerKie — Play. Think. Explore.**
