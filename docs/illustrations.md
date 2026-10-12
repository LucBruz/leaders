# Illustrer les personnages

Les jetons actuels sont des dessins vectoriels tracés en code, dans
`scripts/gen-tokens.mjs`. Ils sont lisibles mais schématiques. Ce document
explique comment les remplacer par de vraies illustrations sans rien casser.

Le pipeline est déjà prêt : chaque figurine lit `public/characters/<id>.svg`.
Déposer un `.png` du même nom et changer l'extension dans `jetonDe`
(`app/data/characters.fr.ts`) suffit. Rien d'autre ne bouge — le moteur ne
connaît que des identifiants.

---

## Le piège : aucun générateur gratuit ne produit de vraie transparence

C'est le point que les comparatifs passent sous silence. Gemini, Flux et
Recraft **ne savent pas écrire de canal alpha**. Demander « fond transparent »
donne un fond blanc, noir, ou un damier *peint* dans l'image. Il y a donc
toujours une étape de détourage, et mieux vaut la prévoir que la découvrir.

D'où le choix fait ici : **générer sur un fond uni criard**, puis le retirer.
Pour un style plat aux contours nets, c'est fiable et instantané.

---

## Quel modèle

| | Licence | Cohérence | Pour qui |
|---|---|---|---|
| **FLUX.2 [klein] 4B** | **Apache 2.0** | 4 images de référence | Le plus sûr pour un site public |
| **Gemini (Nano Banana)** | à vérifier, filigrane SynthID | excellente, en itératif | Le plus simple pour essayer |
| Recraft, offre gratuite | **pas de licence commerciale**, galerie publique | — | À éviter ici |

**Recommandation.** Le dépôt et le site sont publics : la licence compte autant
que la qualité. **FLUX.2 [klein] 4B** est sous Apache 2.0, donc utilisable sans
condition — il demande une carte graphique d'environ 13 Go de mémoire, ou un
service qui l'héberge. Attention : les variantes **9B et dev ne sont pas**
commerciales, seule la **4B** l'est.

À défaut de machine, **Gemini** est gratuit avec un compte Google et tient très
bien la cohérence d'un personnage à l'autre. Deux réserves avant de publier :
le filigrane SynthID, et des conditions d'usage à relire.

Les sources consultées sont majoritairement des blogs d'éditeurs qui se
contredisent, et les offres gratuites changent vite : à revérifier le jour où
l'on s'y met.

---

## Format

| | |
|---|---|
| Fichier | **WebP**, canal alpha, après détourage |
| Cadrage | **portrait 2:3** |
| Taille | **832 × 1248** à la génération |
| Taille finale | **512 px de haut** suffit |

Pourquoi 512 en sortie : la figurine mesure au maximum `CS × 1,98 × 2,4`, soit
environ 350 px à la plus grande échelle du plateau. Le double couvre les écrans
à haute densité. Générer plus grand sert uniquement à garder de la marge au
détourage.

Pourquoi WebP et non PNG : à rendu visuellement équivalent sur de la peinture,
la série entière passe de **7,7 Mo à 0,8 Mo**. Les dix-neuf figurines se
chargent dès la première partie, donc le poids total compte bien plus que
celui d'une image isolée.

Le gabarit de sortie est **512 × 756**, soit exactement le rapport de `.fig`
dans `HexBoard.vue` (1,34 × 1,98). Chaque figurine y est posée **pieds en
bas**, ce que `object-position: bottom` attend. C'est aussi ce qui conserve
les écarts de taille : tout redimensionner à la même hauteur rendrait l'Ourson
aussi grand que le Vieil Ours, et cette confusion-là coûte des parties. Les
facteurs de hauteur vivent dans `TAILLES`, en tête de `scripts/detourer.mjs`.

---

## Le bloc de style, à recopier mot pour mot

C'est lui qui fait tenir la série. **Identique sur les dix-huit**, sans la
moindre variation : c'est la seule chose qui empêche d'obtenir dix-huit
personnages qui ne semblent pas sortir du même jeu.

```
full-body character, standing, feet fully visible, centred in frame,
three-quarter view facing slightly left, camera at chest height,
hand-painted tabletop miniature, 32 mm scale, matte acrylic finish,
visible brush texture, non-metallic metal shading on armour,
cool rim light from the left, warm key light from the upper right,
flat solid magenta background #FF00FF, nothing else in frame,
no ground, no base, no cast shadow, no scenery, no text, no logo, no border
```

Trois détails qui comptent plus qu'ils n'en ont l'air :

- **`no base, no cast shadow`** — l'application dessine déjà le socle et
  l'ombre, en perspective. Une ombre peinte dans l'image donnerait deux ombres
  qui ne se superposent pas.
- **`camera at chest height`** — sans hauteur de caméra fixe, certains
  personnages seront vus de haut et d'autres de face, et le plateau paraîtra
  bancal.
- **`flat solid magenta`** — le magenta n'existe dans aucune peau ni aucun
  métal, donc le détourage ne mange pas la figurine. Le vert, lui, dévore les
  reflets verdâtres.

---

## Les dix-huit descriptions

À coller **après** le bloc de style. Description du rôle uniquement : ces
personnages doivent être les vôtres, pas une reprise de ceux du jeu d'origine.

| Identifiant | Description à ajouter |
|---|---|
| `leader` | `a young monarch in a deep violet robe with gold trim, tall five-pointed crown, holding a slender sceptre, calm and upright posture` |
| `leader-p1` | `a young monarch in a crimson robe with gold trim, tall five-pointed crown, holding a slender sceptre, calm and upright posture` |
| `acrobate` | `a lithe acrobat caught mid-leap, arms spread wide, long ribbons trailing, light blue bodysuit, balancing pole across the shoulders` |
| `cavalier` | `a small rider seated on a large lean four-legged mount, low wide silhouette, tan and cream coat, short riding cloak` |
| `cogneur` | `a hulking brute with enormous shoulders and a tiny head, curved horns, heavy fists, rust-brown hide, planted stance` |
| `gardeRoyal` | `a heavy guard behind a tall rectangular tower shield covering most of the body, plumed helm, halberd upright, royal blue and gold livery` |
| `illusionniste` | `a masked illusionist in pale pink, a faint translucent duplicate of the same figure standing just behind and offset` |
| `lanceGrappin` | `a tinkerer with round brass goggles, bulky backpack, mechanical arm holding a grappling hook, orange leather coat, coiled rope` |
| `manipulatrice` | `a tall sorceress in deep purple, unnaturally long arms, fingers trailing puppet strings, braided hair spreading outward` |
| `rodeuse` | `a crouching hooded prowler, sharply pointed hood, face in shadow with two glowing amber eyes, membranous wings folded back, a dagger in each hand` |
| `tavernier` | `a round jovial innkeeper, wide apron, raising a foamy tankard, ruddy cheeks, shorter and broader than everyone else` |
| `archere` | `an archer with the bow fully drawn, arrow nocked, teal and green leathers, quiver on the hip, focused expression` |
| `assassin` | `a faceless figure in a closed grey hood, no visible features except two pink glowing embers where eyes would be, long thin blade` |
| `geolier` | `a squat jailer with many thick tentacle-like arms, heavy iron keyring, chains draped across the body, deep blue-green` |
| `protecteur` | `a broad immovable guardian of stone and bark, roots gripping the ground, moss and small leaves, mossy green and brown` |
| `vizir` | `a serene advisor in pale robes, very tall mitre headdress bearing a single eye emblem, arms folded, scrolls at the belt` |
| `vieilOurs` | `a stooped old man with a very long white beard, heavy fur cloak, leaning on a tall gnarled staff, warm ochre tones` |
| `ourson` | `a small round bear cub sitting on its haunches, oversized paws, soft golden-orange fur, clearly much smaller than any other figure` |
| `nemesis` | `a menacing spined figure in crimson and black, bone mask covering the face, long spear, jagged silhouette bristling with points` |

---

## Procédure

1. **Commencer par le Leader violet.** C'est lui qui fixe le style. Itérer
   jusqu'à ce qu'il soit juste, puis ne plus y toucher.
2. **Le réutiliser comme image de référence** pour tous les autres. FLUX en
   accepte jusqu'à quatre ; avec Gemini, enchaîner dans la même conversation
   suffit. C'est l'étape qui fait la cohérence, bien plus que le texte.
3. **Le Leader rouge se fait en variante** du violet, pas en nouvelle
   génération : même pose, même visage, robe changée.
4. **L'Ourson doit rester petit.** Il se distingue du Vieil Ours au premier
   coup d'œil, parce qu'il ne participe pas aux captures — une confusion
   coûterait des parties.
5. **Détourer**, puis redimensionner à 512 px de haut.

### Détourage

Il est automatisé, dans `scripts/detourer.mjs` (sharp, aucune dépendance
système). Il lit `art-raw/<id>.png` et écrit `public/characters/<id>.png` :

```bash
node scripts/detourer.mjs            # tout ce qui est dans art-raw/
node scripts/detourer.mjs acrobate   # un seul personnage
```

La commande ImageMagick d'origine, `-fuzz 18% -transparent "#FF00FF"`, a été
abandonnée : elle troue la cape violette du Leader, le violet étant proche du
magenta. Le script ne retire que la zone **reliée au bord de l'image**, ce qui
rend l'intérieur de la figurine intouchable par construction.

Puis `node scripts/planche.mjs` pose toutes les illustrations côte à côte sur
le fond du plateau. Un liseré ou une erreur d'échelle s'y voient d'un coup
d'œil, alors qu'ils passent inaperçus fichier par fichier.

### Récupérer les images depuis AI Studio

Trois obstacles, tous rencontrés :

- **Le rendu est paresseux.** Une image fraîchement générée apparaît d'abord
  comme une vignette `.jpg` cassée ; son `src` en `data:` n'arrive que dix à
  trente secondes plus tard. Compter les images décodées fait donc croire que
  la génération a échoué. Il faut compter les `img` dont l'`alt` commence par
  « Generated Image », sans filtrer sur la taille.
- **La conversation est virtualisée.** Les images anciennes sortent du DOM à
  mesure que le fil s'allonge : il faut les enregistrer au fur et à mesure, et
  non toutes à la fin.
- **Chrome bloque les téléchargements répétés.** Au troisième fichier, le
  navigateur réclame l'autorisation « télécharger plusieurs fichiers » pour le
  site. Tant qu'elle n'est pas accordée, les téléchargements suivants
  échouent en silence — aucun fichier, aucune erreur.

Filet de sécurité : les images en attente sont recopiées dans l'IndexedDB
`leaders-art` de la page, ce qui les met à l'abri de la virtualisation comme
d'un rechargement.

### Brancher les PNG

Une ligne dans `app/data/characters.fr.ts` :

```ts
export function jetonDe(id: CharacterId, seat: 0 | 1, slot = 0): string {
    // ... puis à l'usage : `/characters/${jetonDe(...)}.png`
}
```

Les SVG actuels peuvent rester : ils servent de repli pour tout personnage
qui n'aurait pas encore son illustration.
