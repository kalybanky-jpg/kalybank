# Kit de logo Monalyz — Cadence

Ce dossier contient les déclinaisons de production du concept 02 retenu pour
Monalyz. Le mot-symbole complet est la signature principale. Le `M` seul est
réservé aux surfaces trop étroites pour afficher correctement « Monalyz ».

## Palette

- Aubergine : `#190B21`
- Lilas d'accent : `#B574FC`
- Porcelaine : `#FBFAF7`

Les nuances internes présentes dans les masters raster font partie du rendu
validé. Ces trois références restent les aplats à utiliser dans l'interface.

## Signatures horizontales

| Fichier | Fond conseillé | Usage |
| --- | --- | --- |
| `monalyz-wordmark-primary.png` | clair | Signature principale, documents et grands écrans |
| `monalyz-wordmark-monochrome-dark.png` | clair | Impression monochrome et contextes sobres |
| `monalyz-wordmark-reversed-white.png` | aubergine ou sombre | Connexion, administration et surfaces sombres |
| `monalyz-wordmark-web-720.png` | clair | Export web optimisé |
| `monalyz-wordmark-email-360.png` | clair | E-mails transactionnels |

Les trois masters horizontaux sont des PNG transparents recadrés. Conserver la
zone de respiration incluse dans chaque fichier.

## Monogramme M

| Fichier | Fond conseillé | Usage |
| --- | --- | --- |
| `monalyz-mark-m-primary.png` | clair | Navigation compacte et marque autonome |
| `monalyz-mark-m-monochrome-dark.png` | clair | Documents monochromes |
| `monalyz-mark-m-reversed-white.png` | sombre | Navigation compacte sur fond sombre |

Ne jamais recomposer le `M` avec une police. Ne pas déplacer l'accent lilas et
ne pas l'ajouter à la version monochrome.

## Icônes et plateformes

| Fichier | Dimensions | Usage |
| --- | ---: | --- |
| `monalyz-app-icon-master.png` | 1254 × 1254 | Master raster carré |
| `monalyz-app-icon-1024.png` | 1024 × 1024 | Stores et communications |
| `monalyz-app-icon-512.png` | 512 × 512 | Application web |
| `monalyz-maskable-icon-512.png` | 512 × 512 | Icône PWA maskable |
| `monalyz-app-icon-192.png` | 192 × 192 | Icône PWA |
| `monalyz-apple-touch-icon-180.png` | 180 × 180 | Apple touch icon |
| `monalyz-favicon.ico` | 16, 32 et 48 px | Favicon multi-résolution |
| `monalyz-favicon-16.png` | 16 × 16 | Favicon minimal |
| `monalyz-favicon-32.png` | 32 × 32 | Favicon standard |
| `monalyz-favicon-48.png` | 48 × 48 | Favicon haute densité |
| `monalyz-avatar-1024.png` | 1024 × 1024 | Avatar de marque et réseaux |

Les icônes sont volontairement carrées et sans masque arrondi externe : le
système cible applique lui-même sa forme. Le dessin reste dans la zone sûre
centrale pour supporter les masques adaptatifs.

## Règles essentielles

- Utiliser le mot-symbole dès que la largeur disponible le permet.
- Utiliser le `M` seul sous environ 160 px de largeur disponible.
- Ne pas étirer, incliner, contourer ou recolorer les fichiers.
- Ne pas ajouter de bâtiment, bouclier, pièce, graphique ou symbole bancaire.
- Préserver un contraste WCAG suffisant entre la variante et son fond.
- Fournir un libellé accessible « Monalyz — accueil » sur un lien-logo ; rendre
  l'image décorative si le même texte est déjà annoncé.

## Source et évolution

La source créative approuvée est
`../concepts/monalyz-logo-concept-02-cadence.png`. Ce kit est un jeu de masters
raster propre à la validation et à l'intégration MVP. Un redessin vectoriel
manuel en tracés restera nécessaire avant impression grand format ou dépôt de
marque ; aucun faux SVG contenant seulement un PNG encapsulé n'est fourni.
