# Kit de logo Monalyz — Cadence

Ce dossier contient les masters vectoriels et les exports reproductibles du
concept 02 retenu. Le mot-symbole complet est la signature principale. Le `M`
seul est réservé aux surfaces trop étroites pour afficher correctement
« Monalyz ».

## Palette

- Aubergine : `#190B21`
- Lilas d'accent : `#B574FC`
- Porcelaine : `#FBFAF7`

Tous les masters utilisent exclusivement ces aplats. Ils ne contiennent ni
police, texte vivant, image raster, contour, filtre, motif ou dégradé.

## Masters SVG

| Fichier | Dimensions intrinsèques | Usage |
| --- | ---: | --- |
| `monalyz-wordmark-primary.svg` | 1120 × 320 | Signature couleur sur fond clair |
| `monalyz-wordmark-monochrome-dark.svg` | 1120 × 320 | Impression monochrome sur fond clair |
| `monalyz-wordmark-reversed-white.svg` | 1120 × 320 | Signature porcelaine sur fond sombre |
| `monalyz-mark-m-primary.svg` | 320 × 320 | Navigation compacte sur fond clair |
| `monalyz-mark-m-monochrome-dark.svg` | 320 × 320 | Monogramme monochrome |
| `monalyz-mark-m-reversed-white.svg` | 320 × 320 | Navigation compacte sur fond sombre |
| `monalyz-app-icon.svg` | 1024 × 1024 | Source carrée pour icônes et favicons |

Le monogramme reprend exactement l'anatomie asymétrique du premier glyphe du
wordmark : hampe gauche fine, diagonale descendante forte, remontée et hampe
droite contrastées. Son terminal lilas reste au même emplacement dans l'icône
d'application. La géométrie et le placement de l'accent sont optimisés pour
rester lisibles entre 16 et 24 px.

## Exports PNG et ICO

Les 19 exports historiques conservent leurs noms et dimensions :

- wordmarks : `monalyz-wordmark-primary.png` (1399 × 362),
  `monalyz-wordmark-monochrome-dark.png` (1286 × 333),
  `monalyz-wordmark-reversed-white.png` (1279 × 327),
  `monalyz-wordmark-web-720.png` (720 × 186) et
  `monalyz-wordmark-email-360.png` (360 × 93) ;
- monogrammes : `monalyz-mark-m-primary.png` (931 × 860),
  `monalyz-mark-m-monochrome-dark.png` (917 × 874) et
  `monalyz-mark-m-reversed-white.png` (917 × 874) ;
- icônes : master 1254 px, formats 1024, 512 et 192 px, maskable 512 px,
  Apple touch 180 px, avatar 1024 px et favicons PNG 16, 32 et 48 px ;
- `monalyz-favicon.ico`, qui contient les trois résolutions 16, 32 et 48 px.

Les cartes sociales opaques
`monalyz-opengraph-1200x630.png` et
`monalyz-twitter-1200x630.png` sont également générées en 1200 × 630.

## Génération et contrôle

```bash
npm run brand:build
npm run brand:check
```

`brand:build` rend tous les PNG avec `sharp`, puis assemble les trois PNG de
favicon dans un ICO multi-résolution. `brand:check` est strictement non mutant :
il reconstruit les sorties en mémoire et vérifie leur identité binaire avec les
fichiers suivis.

Les contrôles portent sur les dimensions, la transparence, la zone sûre des
icônes, la palette, la structure path-only des SVG et le contenu du favicon.
Toute modification d'un master doit être suivie de `brand:build`, puis de
`brand:check`.

## Règles d'utilisation

- Utiliser le wordmark dès qu'au moins 160 px de largeur sont disponibles.
- Utiliser le `M` seul dans les surfaces compactes.
- Ne pas étirer, incliner, contourer, recomposer ou recolorer les fichiers.
- Ne pas déplacer l'accent lilas.
- Ne pas ajouter de bâtiment, bouclier, pièce, graphique ou symbole bancaire.
- Préserver un contraste WCAG suffisant entre la variante et son fond.
- Fournir un libellé accessible « Monalyz — accueil » sur un lien-logo ; rendre
  l'image décorative si le même texte est déjà annoncé.

## Source créative

La piste visuelle approuvée reste
`../concepts/monalyz-logo-concept-02-cadence.png`. Les sept SVG de ce dossier
sont désormais les masters de production ; les PNG et le favicon ne doivent
pas être modifiés manuellement.
