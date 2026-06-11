# HANDOFF — Migrazione completa Noit a Skia

> Documento operativo per continuare in una nuova chat. Leggi anche `CLAUDE.md`
> (§Skia Migration + §Device-test findings) per il contesto completo.

## 🎯 Obiettivo

Convertire **tutte le mascotte Noit** dell'app da `react-native-svg` a
`@shopify/react-native-skia`. **Non è un'ottimizzazione: è obbligatorio.**

### Scope preciso: cosa va in Skia e cosa NO
- **Noit (tutte le mascotte) → 100% Skia, ZERO nodi SVG residui.** OGNI dettaglio
  dentro il Noit è Skia, nessuna eccezione: corpo, piumini, bib, **forchetta
  (rebbi/shaft/grip/pommel)**, occhi, **shine/riflessi degli occhi**, bocca,
  sopracciglia, guance, piedi, **stella del bib**, **stelline gialle sulle punte
  dei piumini**, aura, sparkle particles. Tutto dentro `<Canvas>` con primitive
  Skia (`Path`/`Circle`/`Oval`/`Line`). Lasciare anche un solo pezzo del Noit in
  `react-native-svg` può ancora innescare il crash nativo → non farlo.
  (Nella variante `idle` già fatta: forchetta, stella bib, shine occhi sono GIÀ
  Skia. Mancano solo stelline-piumini + aura + sparkle, rimandate allo step
  dedicato — ma andranno anch'esse in Skia, NON in SVG.)
- **Altri SVG dell'app (NON mascotte) → restano SVG, per ora.** Es.: stelle di
  sfondo in `index.tsx` (`STARS`), icona Google nel bottone login, eventuali
  icone. Sono leggeri e STATICI (non animati) → non causano il crash (il crash
  era il Noit: ~60 nodi + ~10 animazioni a ogni frame). Convertirli sarebbe
  lavoro inutile. ⚠️ Ipotesi ragionevole non certa: se dopo aver tolto il Noit
  SVG l'app gira liscia, l'SVG leggero residuo va bene; se restano problemi,
  valutare caso per caso. NON convertire alla cieca.

## 🔴 Perché (fatto confermato su device)

Il Noit SVG **crasha nativamente** l'app su Android reale (Xiaomi). Provato con
test diagnostico: nell'onboarding, lo step con `<NoitSkia>` regge, lo step
successivo con `<Noit>` SVG **crasha appena ci si arriva**. Il crash è NATIVO
(nessun ErrorBoundary/try-catch JS lo cattura — schermata di crash secca).
Causa: `react-native-svg` con ~60 nodi + ~10 shared value Reanimated animati è
troppo pesante per questo hardware. → **Finché c'è UN solo `<Noit>` SVG montato,
quella schermata può crashare. Vanno convertiti tutti.**

## ✅ Stato attuale (già fatto)

- **`src/components/noit-skia.tsx`** — variante **`idle`** completa, validata su
  device (resa identica all'SVG, blink fixato). È il PROTOTIPO di riferimento:
  il metodo di conversione SVG→Skia è dimostrato corretto.
- **`Noit.tsx`** (SVG originale) — INTATTO, ancora usato in ~13 schermate.
- **`NoitMini.tsx`** — wrapper di `Noit` static, invariato.
- Usi TEMP di NoitSkia: `src/app/index.tsx` (auth, idle 180) e
  `src/app/onboarding.tsx` step 1 (idle 200, era il test diagnostico).
- EAS Update OTA funziona (`eas update --branch preview`), env preview caricate,
  expo-updates installato, runtimeVersion `appVersion`.
- Diagnostici TEMP da rimuovere a fine lavoro: `src/components/crash-screen.tsx`
  + ErrorBoundary/global handler in `_layout.tsx`.

## 📐 Metodo di conversione SVG→Skia (già validato su idle)

Skia e SVG condividono coordinate e path string. Conversione 1:1:

| SVG | Skia |
|---|---|
| `<Ellipse cx cy rx ry>` | `<Oval rect={rect(cx-rx, cy-ry, 2*rx, 2*ry)} />` |
| `<Path d="...">` | `<Path path="..." />` (STESSA stringa) |
| `<Circle cx cy r>` | `<Circle cx cy r />` (identico) |
| `<Line x1 y1 x2 y2>` | `<Line p1={{x,y}} p2={{x,y}} style="stroke" />` |
| `fill="#xxx"` | `color="#xxx"` |
| `stroke` + `strokeWidth` | `style="stroke"` + `color` + `strokeWidth` |
| `rotate(a cx cy)` | `<Group transform={[{rotateZ: a*Math.PI/180}]} origin={{x:cx,y:cy}}>` |

**ViewBox:** Skia non ha viewBox. Il root `<Group>` mappa lo spazio
`-20 -22 240 252` sul canvas: `translate(-VB_MIN_X*scale, (-VB_MIN_Y+floatY)*scale)`
+ `scale` dove `scale = canvasW/240` (uniforme; 240*1.05=252 → height torna).
**Ogni coordinata interna resta lo STESSO numero dell'SVG** — non ri-tarare.

**Animazioni:** riusare le STESSE shared value Reanimated dell'SVG (stesso
timing) → collegarle via `useDerivedValue` ai `transform` dei `<Group>`.
`<Canvas>` su nativo NON richiede Provider.

### ⚠️ Regola transform Skia (imparata col bug del blink)
- **scale attorno a un punto** (es. blink occhi, breathe body): usa il pattern
  `[{translateY:cy},{scaleY:v},{translateY:-cy}]` DENTRO il transform, **SENZA**
  `origin`. (Mettere sia translate manuale SIA `origin` → doppia traslazione →
  "occhi che cadono".)
- **rotate attorno a un punto** (es. piumini, mani): usa
  `transform={[{rotateZ: rad}]}` + `origin={{x,y}}`, **SENZA** translate manuale.

## 📋 Le 8 varianti da implementare

Tutte condividono la base idle (corpo/piumini/bib/forchetta/piedi/guance).
Cambiano solo **occhi + bocca + sopracciglia** e alcune **animazioni**.
Geometria esatta di ogni variante: copiarla da `src/components/Noit.tsx`
(è la fonte di verità — stessi numeri).

1. **`happy`** — occhi `^^` (2 path arc verso l'alto), bocca aperta, sopracciglia happy. (onboarding step 2)
2. **`curious`** — pupille up-left (Circle + sparkle), bocca piccola, sopracciglia curious. (onboarding step 3, ExitConfirm)
3. **`wink`** — occhio L star + occhio R chiuso (arc), sopracciglia wink. (onboarding step 4)
4. **`excited`** — occhi star grandi (r=15), bocca aperta. (onboarding step 5)
5. **`listening`** — come idle ma head tilt + L fin alzata; anim `tilt`.
6. **`thinking`** — pupille + sopracciglia thinking; anim `tilt`.
7. **`eating`** — corpo puff (rx96 ry102), X eyes (4 Line), guance grandi 32×24, bocca aperta scura, fin/piedi riposizionati; anim `breathe` eating (1.02↔1.12 @280ms) + `jiggle`. ⚠️ la variante più diversa: geometria del corpo cambia.
8. **`eyes_closed`** — occhi arc verso il basso; usata in BreatheScreen.

Le animazioni per-variante (tilt, jiggle, finL/R, antenna sway, sparkle) sono
nel `Noit.tsx` originale — riusare stesse shared value + timing via
`useDerivedValue`.

## 🪜 Piano a step (ognuno = 1 `eas update` + check su device)

1. Implementa `happy`, `curious`, `wink`, `excited` (le 4 che servono
   all'onboarding) → converti i 6 `<Noit>` di `onboarding.tsx` in `<NoitSkia>`
   → update → verifica onboarding INTERO non crasha più.
2. Implementa `listening`, `thinking`, `eating`, `eyes_closed`.
3. Aggiungi aura (RadialGradient Skia nativo) + sparkle (3 stelle, props
   `glow`/`showSparkles` già nell'API).
4. **Swap globale:** fai `Noit` (in `Noit.tsx`) diventare un wrapper che rende
   `<NoitSkia {...props} />`. Così TUTTE le 13 schermate passano a Skia senza
   toccarle. `NoitMini` continua a usare `Noit` (→ NoitSkia static) invariato.
5. Ripristina gli usi TEMP "puliti": auth torna a `state="happy"`, onboarding
   step 1 torna alla variante originale (ora servite da NoitSkia via wrapper).
6. Rimuovi i diagnostici: `crash-screen.tsx`, ErrorBoundary + global handler in
   `_layout.tsx`.
7. Build preview finale (`eas build --profile preview --platform android`) →
   verifica zero crash su tutta l'app + misura fluidità.

## 🔧 Workflow tecnico

- **Iterare senza ri-build:** `eas update --branch preview -m "..."`. Sul
  telefono: chiudi app completamente → riapri (scarica) → richiudi → riapri
  (applica). Update solo JS → niente ri-build (Skia è già nel bundle nativo).
- **Serve ri-build SOLO se** si aggiunge una dep nativa nuova (non è il caso:
  Skia è già installato).
- **Verifica prima di ogni update:** `npx tsc --noemit` (0 errori) +
  `npx eslint src/components/noit-skia.tsx`.
- ⚠️ Se `expo config` / `eas update` crasha su PowerShell con `0xC0000409`:
  riapri il terminale (processo Node corrotto).

## 📁 File chiave

- `src/components/noit-skia.tsx` — il nuovo componente (idle fatto, aggiungere varianti)
- `src/components/Noit.tsx` — SVG originale = fonte di verità per geometria varianti
- `src/components/NoitMini.tsx` — wrapper (non toccare, seguirà Noit→NoitSkia)
- `src/app/index.tsx`, `src/app/onboarding.tsx` — usi TEMP da ripristinare
- `src/app/_layout.tsx` + `src/components/crash-screen.tsx` — diagnostici da rimuovere
