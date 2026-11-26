# NOCTURNE: BENEATH THE SILENT FACILITY — GamerKie Original

**हिंदी में प्रोजेक्ट गाइड (मुख्य README)**

यह एक original cinematic 2.5D side-scrolling puzzle-platformer है। इसे आपके दिए गए reference frames की visual direction से बनाया गया है: नीला-काला underwater world, दूर से दिखता छोटा लाल-जैकेट वाला character, लकड़ी का भारी barricade, industrial searchlight, glass observation room, टूटा हुआ ऊँचा walkway और धुँध में खड़े लोगों वाला अंतिम hall। यह किसी commercial game की exact copy नहीं है; सभी locations, character artwork और level layout इस project के लिए original हैं।

## 🎮 इस नए version में क्या बदला है?

- **Underwater opening:** तैरना, ऊपर-नीचे जाना, bubbles, underwater plants, light shafts और पानी में लटकी silhouettes।
- **Timber Gate:** पुराने लकड़ी के boards को तोड़कर रास्ता खोलने का hold-to-interact puzzle।
- **The Watcher:** घूमती हुई searchlight cone; खड़े रहने पर रोशनी में आने से खतरा, crouch करके बचें।
- **Observation Wing:** बड़े glass windows, interior equipment और पीछे दिखाई देती human silhouettes।
- **The Hollow Walk:** पानी/अंधेरे के ऊपर टूटे हुए staggered platforms पर jump करके पार जाएँ।
- **The Last Crowd:** दूर खड़े लोगों की परछाइयों वाला बड़ा doorway, switch और final exit sequence।
- Camera follow, parallax skyline, volumetric-style light cones, mist, particles, cinematic vignette, jump/swim character animation और soft ambient audio cues।
- Checkpoint respawn, deaths counter, Pause/Resume, Restart, Fullscreen, Sound toggle और progress display।
- Keyboard तथा mobile touch controls; mobile के लिए landscape layout।
- कोई backend, API key, paid asset या external game engine आवश्यक नहीं। Artwork Canvas पर procedural रूप से draw होता है।

## 🕹️ Controls

| काम | Keyboard | Mobile |
|---|---|---|
| आगे / पीछे | A / D या ← / → | Left / Right |
| पानी में ऊपर / जमीन पर Jump | Space / W / ↑ | ↑ Button |
| पानी में नीचे / जमीन पर Crouch | S / ↓ | ↓ Button |
| Boards तोड़ना / Switch चलाना | E दबाकर रखें | E Button दबाकर रखें |
| Pause / Resume | Esc या P | ऊपर Pause icon |
| Checkpoint से reset | R | Pause menu में Restart |

**ध्यान दें:** Underwater section में ↑ और ↓ swimming controls हैं। जमीन पर वही ↑ Jump और ↓ Crouch करते हैं। Timber Gate और अंतिम switch के पास E को तब तक दबाकर रखें जब तक progress पूरा न हो जाए।

## 💻 अपने कंप्यूटर पर चलाएँ

**जरूरत:** Node.js 20.9 या नया।

```bash
npm install
npm run dev
```

ब्राउज़र में `http://localhost:3000` खोलें।

## 🧪 Tests और Production Build

```bash
npm test
npm run build
```

Unit tests level progression, water zone, searchlight collision cone, hold interaction progress और basic physics helpers जाँचते हैं। Successful static export के बाद `out/` folder बनता है।

## 🚀 GitHub Pages पर Deploy करें

1. GitHub पर नया **Public Repository** बनाएँ, जैसे `nocturne-game`।
2. इस ZIP को extract करें। Extract किए गए folder के अंदर की सभी files और folders repository के **root** में upload करें।
3. **`.github` folder और उसके अंदर `workflows/deploy.yml` को जरूर upload करें।** यह hidden folder है; mobile file picker इसे छिपा सकता है। जरूरत पड़े तो GitHub web upload या desktop browser का उपयोग करें।
4. Repository की default branch `main` रखें।
5. Repository में **Settings → Pages → Build and deployment → Source** खोलकर **GitHub Actions** चुनें।
6. **Actions** tab में `Deploy NOCTURNE to GitHub Pages` workflow शुरू होगा। Build और Deploy दोनों jobs के हरे होने तक प्रतीक्षा करें।
7. Deployment URL यह होगा:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/
```

Workflow repository के नाम के अनुसार `basePath` अपने आप set करता है। `public/.nojekyll` file भी शामिल है।

### Deployment fail हो तो

- Actions खोलें और latest failed workflow चुनें।
- लाल ❌ वाले step को expand करके सबसे नीचे का पूरा error देखें।
- `npm install` fail हो तो dependency/network error; `npm run build` fail हो तो Next.js build error; `Upload Pages artifact` fail हो तो `out/` output की जाँच करें।
- `.github/workflows/deploy.yml` मौजूद हो और Pages source `GitHub Actions` हो।
- सिर्फ red cross का screenshot नहीं, failed step की आखिरी 20–30 log lines भी साझा करें।

## 📰 Blogger में Embed करें

1. `blogger/iframe-embed.html` खोलें।
2. `YOUR-GITHUB-USERNAME` और `YOUR-REPOSITORY` को अपने GitHub username और repository name से बदलें।
3. Blogger post editor में **HTML View** खोलें।
4. पूरी iframe snippet paste करके post publish करें।
5. Search title और description के लिए `BLOGGER-SEO.txt` देखें।

## 📁 Project Structure

```text
app/
  game/engine.js          Canvas 2.5D-style game engine
  globals.css             Responsive dark interface
  layout.jsx              Next.js metadata and layout
  page.jsx                Game screen, HUD, touch controls
lib/
  physics.js              Collision helpers
  level.js                Chapter routing, water, light, interaction rules
 tests/
  physics.test.js         Collision unit tests
  level.test.js           Gameplay-rule tests
  engine-smoke.test.js    Full route / game completion smoke test
blogger/
  iframe-embed.html       Blogger iframe code
.github/workflows/
  deploy.yml              GitHub Pages workflow
public/
  .nojekyll               GitHub Pages static file support
README.md                 हिंदी README
README-EN.md              English README
BLOGGER-SEO.txt           Blogger title and description
UPLOAD-HINDI.md           ZIP upload guide
DEPLOYMENT-FIX-HINDI.md   Deployment troubleshooting
```

## ℹ️ तकनीकी और visual सीमा

यह Canvas 2D पर procedural shapes, gradients, shadows, parallax, fog, light cones और animation से बनाया गया cinematic 2.5D presentation है; यह full 3D model-based AAA rendering नहीं है। इसे reference image की composition और atmosphere के करीब लाने के लिए बनाया है, पर final look screen size/device पर थोड़ा अलग हो सकता है। इस environment में npm registry timeout की वजह से Next.js production build execute नहीं हो सका; GitHub Actions deployment में पहली बार dependency installation और production build verify होंगे। `npm test` और JavaScript syntax checks स्थानीय रूप से पास किए गए हैं।

**GamerKie — Play. Think. Explore.**
