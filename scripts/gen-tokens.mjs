// Génère les 18 jetons SVG dans public/characters/.
//
// Principes de dessin, dans l'ordre d'importance :
//  1. SILHOUETTE. Un jeton doit être reconnaissable à 36 px, en vignette, de
//     dos sur un plateau incliné. La forme de la tête et le contour général
//     portent presque toute l'information ; la couleur ne vient qu'après.
//  2. UN SEUL ACCESSOIRE marquant par personnage, qui dit son rôle : l'arc de
//     l'Archère, le bouclier du Garde Royal, le bâton du Vieil Ours.
//  3. AUCUNE REPRISE de l'univers graphique de l'illustratrice du jeu. Ces
//     dessins sont originaux, volontairement géométriques et plats, et n'ont
//     pas vocation à ressembler aux figurines d'origine.
//
// Repère commun : viewBox 0 0 100 120, figure centrée en x = 50, posée sur la
// ligne de sol y = 118. Un contour sombre unifié assure la lisibilité sur le
// bois clair du plateau.
//
// Ces fichiers sont des ASSETS, pas du code généré à la volée : ils sont
// versionnés et peuvent être remplacés un par un par de vraies illustrations
// sans toucher à ce script.

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'characters')

const INK = '#241f1b'
const SKIN = '#f0d3b4'
const SKIN_D = '#3b2f28'

// Contour commun : c'est lui qui fait tenir la lecture en petit.
//
// Ces constantes ne déclarent NI `stroke` NI `stroke-width`, ni les jointures :
// ces attributs sont posés une seule fois sur le <g> englobant, et hérités. Les
// mettre ici ferait qu'un élément surchargeant sa couleur se retrouverait avec
// un attribut dupliqué — ce qui casse le parsing XML, et un SVG chargé via
// <img> est parsé en XML strict. L'image ne s'affiche alors pas du tout.
const S = ''
const SF = `stroke-width="2"`

const TOKENS = {
    // ── Leader ────────────────────────────────────────────────────────────
    leader: {
        palette: ['#7b4bc4', '#b98cf0', '#e9c54a'],
        // Le Leader est la seule figurine dont il faut reconnaître le camp
        // instantanément : la couleur du socle n'y suffit pas, les deux Leaders
        // se ressemblaient trop. Il reçoit donc une variante par siège.
        variants: { p1: ['#c23b5c', '#f2a0b4', '#e9c54a'] },
        art: (a, b, c) => `
      <path d="M50 112c-16 0-26-5-26-5l6-48h40l6 48s-10 5-26 5z" fill="${a}" ${S}/>
      <path d="M44 60h12l3 50a40 40 0 0 1-18 0z" fill="${b}" ${SF}/>
      <circle cx="50" cy="44" r="12" fill="${SKIN}" ${S}/>
      <path d="M34 36l4 11 5-14 7 14 7-14 5 14 4-11 2 12H32z" fill="${c}" ${S}/>
      <path d="M72 50v58" ${S} fill="none"/>
      <circle cx="72" cy="46" r="6" fill="${c}" ${S}/>
      <circle cx="45" cy="44" r="1.8" fill="${SKIN_D}"/><circle cx="55" cy="44" r="1.8" fill="${SKIN_D}"/>`,
    },

    // ── Compétences actives ───────────────────────────────────────────────
    acrobate: {
        // En plein saut : jambes repliées, bras tendus, perche en diagonale.
        palette: ['#2f7fd0', '#8fc8f2', '#f2e3b0'],
        art: (a, b, c) => `
      <path d="M18 46L82 88" ${S} stroke="${c}" stroke-width="5" fill="none"/>
      <circle cx="50" cy="34" r="12" fill="${a}" ${S}/>
      <path d="M50 46c10 0 15 8 15 18l-4 26H39l-4-26c0-10 5-18 15-18z" fill="${a}" ${S}/>
      <path d="M39 90l-8 24M61 90l8 24" ${S} stroke="${a}" stroke-width="8" fill="none"/>
      <path d="M36 56L14 44M64 56l22 12" ${S} stroke="${a}" stroke-width="7" fill="none"/>
      <circle cx="45" cy="32" r="2.2" fill="#fff"/><circle cx="56" cy="32" r="2.2" fill="#fff"/>
      <path d="M44 40q6 5 12 0" fill="none" ${SF}/>`,
    },
    cavalier: {
        // Silhouette basse et large : monture quadrupède, cavalier menu dessus.
        palette: ['#c08a3e', '#efdcb6', '#8e4f2a'],
        art: (a, b, c) => `
      <path d="M16 70q6-14 22-14h30q16 0 20 14l4 22-8 4-4-14-10 2-4 14h-8l-3-14H42l-4 14h-8l-4-16-8-2z" fill="${b}" ${S}/>
      <path d="M78 56l10-14 6 6-8 14z" fill="${b}" ${S}/>
      <path d="M86 44l4-9 4 10-5 4z" fill="${a}" ${SF}/>
      <path d="M16 70q-8-6-10-16 10 2 14 8z" fill="${a}" ${SF}/>
      <circle cx="89" cy="50" r="1.8" fill="${SKIN_D}"/>
      <path d="M42 54l6-14h12l-4 14z" fill="${c}" ${S}/>
      <circle cx="52" cy="34" r="8" fill="${a}" ${S}/>
      <path d="M44 30q8-7 16 0" fill="none" ${SF} stroke="${c}"/>`,
    },
    cogneur: {
        // Trapèze massif : épaules très larges, tête minuscule, cornes.
        palette: ['#a85c2e', '#d99a63', '#f2e9d4'],
        art: (a, b, c) => `
      <path d="M26 54q-14-12-20-4 4 12 16 16z" fill="${c}" ${S}/>
      <path d="M74 54q14-12 20-4-4 12-16 16z" fill="${c}" ${S}/>
      <path d="M50 36c14 0 22 9 22 19s-9 13-22 13-22-3-22-13 8-19 22-19z" fill="${b}" ${S}/>
      <path d="M24 70h52l8 40q-34 9-68 0z" fill="${a}" ${S}/>
      <circle cx="41" cy="52" r="3" fill="#fff" stroke-width="1.4"/>
      <circle cx="59" cy="52" r="3" fill="#fff" stroke-width="1.4"/>
      <path d="M44 62h12" ${SF} fill="none"/>
      <path d="M20 84l-6 26M80 84l6 26" ${S} stroke="${a}" stroke-width="10" fill="none"/>`,
    },
    gardeRoyal: {
        // Grand bouclier rectangulaire plein cadre, hallebarde, heaume à plume.
        palette: ['#b2487f', '#e9b8d4', '#e9c54a'],
        art: (a, b, c) => `
      <path d="M76 24v92" ${S} stroke="${c}" stroke-width="5" fill="none"/>
      <path d="M76 24l10 10-10 10-6-10z" fill="${c}" ${S}/>
      <path d="M50 30a11 11 0 0 1 11 11v8H39v-8a11 11 0 0 1 11-11z" fill="${b}" ${S}/>
      <path d="M50 20q8 2 6 12" fill="none" ${S} stroke="${c}" stroke-width="4"/>
      <path d="M38 49h24l6 60H32z" fill="${a}" ${S}/>
      <path d="M14 48h34v54l-17 10-17-10z" fill="${c}" ${S}/>
      <path d="M22 56h18v38l-9 6-9-6z" fill="${a}" ${SF}/>
      <path d="M41 42h18" ${SF} fill="none" stroke="${SKIN_D}"/>`,
    },
    illusionniste: {
        // Un double fantôme décalé derrière : la silhouette dit « deux ».
        palette: ['#e08ab4', '#f7d2e4', '#6ad0c8'],
        art: (a, b, c) => `
      <g opacity=".42">
        <circle cx="66" cy="42" r="11" fill="${a}"/>
        <path d="M66 53c11 0 16 8 16 18l-3 41H53l-3-41c0-10 5-18 16-18z" fill="${a}"/>
      </g>
      <circle cx="40" cy="42" r="12" fill="${b}" ${S}/>
      <path d="M40 54c12 0 18 9 18 20l-4 42H26l-4-42c0-11 6-20 18-20z" fill="${b}" ${S}/>
      <path d="M28 40h24" ${S} stroke="${c}" stroke-width="5" fill="none"/>
      <circle cx="34" cy="46" r="2" fill="${SKIN_D}"/><circle cx="46" cy="46" r="2" fill="${SKIN_D}"/>
      <circle cx="40" cy="78" r="7" fill="${c}" ${SF}/>`,
    },
    lanceGrappin: {
        // Lunettes rondes, sac à dos, grappin au bout d'un câble en arc.
        palette: ['#d9601f', '#f2a765', '#4aa8b8'],
        art: (a, b, c) => `
      <path d="M68 46q26 10 20 46" fill="none" ${S} stroke="${c}" stroke-width="3"/>
      <path d="M84 96l-6 8 12 2z" fill="${c}" ${S} stroke-width="2"/>
      <path d="M26 56h14v34H22z" fill="${b}" ${S}/>
      <circle cx="50" cy="40" r="13" fill="${SKIN}" ${S}/>
      <path d="M36 34h28" ${S} stroke="${a}" stroke-width="6" fill="none"/>
      <circle cx="43" cy="42" r="5" fill="${c}" ${SF}/><circle cx="57" cy="42" r="5" fill="${c}" ${SF}/>
      <path d="M38 53h24l6 57H32z" fill="${a}" ${S}/>
      <path d="M62 56l12 -8" ${S} stroke="${a}" stroke-width="8" fill="none"/>`,
    },
    manipulatrice: {
        // Très haute, bras-tentacules qui s'écartent, croix de marionnettiste.
        palette: ['#7a3fae', '#c893e8', '#f0d9a0'],
        art: (a, b, c) => `
      <path d="M50 26q-16 0-22 14M50 26q16 0 22 14" fill="none" ${S} stroke="${b}" stroke-width="4"/>
      <path d="M22 40q-10 10-8 26M78 40q10 10 8 26" fill="none" ${S} stroke="${b}" stroke-width="4"/>
      <circle cx="50" cy="38" r="11" fill="${SKIN}" ${S}/>
      <path d="M50 49c12 0 17 10 17 22l-5 45H38l-5-45c0-12 5-22 17-22z" fill="${a}" ${S}/>
      <path d="M36 70h28" ${SF} fill="none" stroke="${c}"/>
      <path d="M30 60h40M50 54v18" ${SF} fill="none" stroke="${c}"/>
      <circle cx="45" cy="38" r="2" fill="${SKIN_D}"/><circle cx="55" cy="38" r="2" fill="${SKIN_D}"/>`,
    },
    rodeuse: {
        // Capuche très pointue et avançante, visage dans l'ombre, ailes
        // repliées en arrière plutôt qu'écartées : écartées, elles formaient
        // une masse ronde qui se lisait comme une théière en petit.
        palette: ['#5b3fa0', '#9a7ed8', '#2f2a4a'],
        art: (a, b, c) => `
      <path d="M40 58L18 34q-6 26 8 42z" fill="${c}" ${S}/>
      <path d="M60 58l22-24q6 26-8 42z" fill="${c}" ${S}/>
      <path d="M50 18l16 26H34z" fill="${a}" ${S}/>
      <path d="M38 44h24l6 24-6 44H38l-6-44z" fill="${a}" ${S}/>
      <path d="M38 40h24v12H38z" fill="${c}" ${SF}/>
      <circle cx="44" cy="46" r="2.4" fill="#ffe36b"/><circle cx="56" cy="46" r="2.4" fill="#ffe36b"/>
      <path d="M32 70h36" ${SF} fill="none" stroke="${b}"/>
      <path d="M26 74l-8 22M74 74l8 22" stroke="#cfd4e0" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
    },
    tavernier: {
        // Rond, tablier, chope levée. Le seul personnage plus large que haut.
        palette: ['#c2443c', '#efc18a', '#d9a441'],
        art: (a, b, c) => `
      <path d="M50 50c20 0 30 14 30 32s-12 28-30 28-30-10-30-28 10-32 30-32z" fill="${a}" ${S}/>
      <path d="M36 62h28q4 20-1 44a44 44 0 0 1-26 0q-5-24-1-44z" fill="${b}" ${S}/>
      <circle cx="50" cy="34" r="12" fill="${SKIN}" ${S}/>
      <path d="M36 30q14-12 28 0" fill="none" ${S} stroke="${b}" stroke-width="5"/>
      <circle cx="45" cy="34" r="1.8" fill="${SKIN_D}"/><circle cx="55" cy="34" r="1.8" fill="${SKIN_D}"/>
      <path d="M42 42q8 5 16 0" fill="none" ${SF}/>
      <path d="M76 54h14v22H76z" fill="${c}" ${S}/>
      <path d="M90 60h6v10h-6z" fill="${c}" ${SF}/>`,
    },

    // ── Compétences passives ──────────────────────────────────────────────
    archere: {
        // Arc bandé plein cadre : l'accessoire fait toute la silhouette.
        palette: ['#2f8f7a', '#7ad6b8', '#e8d9b0'],
        art: (a, b, c) => `
      <path d="M78 18q18 36 0 76" fill="none" ${S} stroke="${a}" stroke-width="5"/>
      <path d="M78 18L62 56l16 38" fill="none" stroke="${c}" stroke-width="2"/>
      <path d="M30 56h44" ${S} stroke="${c}" stroke-width="3" fill="none"/>
      <path d="M30 56l8-5v10z" fill="${c}" ${SF}/>
      <circle cx="46" cy="36" r="11" fill="${SKIN}" ${S}/>
      <path d="M35 32q11-10 22 0" fill="none" ${S} stroke="${a}" stroke-width="5"/>
      <path d="M36 47h20l7 63H30z" fill="${a}" ${S}/>
      <path d="M36 47h20l3 16H34z" fill="${b}" ${SF}/>
      <circle cx="42" cy="37" r="1.8" fill="${SKIN_D}"/><circle cx="51" cy="37" r="1.8" fill="${SKIN_D}"/>`,
    },
    assassin: {
        // Capuche fermée sans visage, deux braises à la place des yeux.
        palette: ['#3c3a46', '#6f6c80', '#ff5e8a'],
        art: (a, b, c) => `
      <path d="M50 20c16 0 24 14 24 29l-5 63H31l-5-63c0-15 8-29 24-29z" fill="${a}" ${S}/>
      <path d="M50 20c16 0 24 14 24 29l-2 15H28l-2-15c0-15 8-29 24-29z" fill="${b}" ${SF}/>
      <path d="M38 44q12-7 24 0" fill="${INK}" opacity=".5"/>
      <circle cx="44" cy="46" r="3" fill="${c}"/><circle cx="56" cy="46" r="3" fill="${c}"/>
      <path d="M80 46l6 56" ${S} stroke="${c}" stroke-width="4" fill="none"/>
      <path d="M78 42h10l-2 8h-6z" fill="${b}" ${SF}/>`,
    },
    geolier: {
        // Masse basse à tentacules, grosse clé, chaîne : le gardien de prison.
        palette: ['#2f7f9e', '#6fc0d6', '#e9c54a'],
        art: (a, b, c) => `
      <path d="M50 34c17 0 26 13 26 28H24c0-15 9-28 26-28z" fill="${a}" ${S}/>
      <path d="M24 62h52q2 22-6 30-6-10-10 0-5-12-10 0-5-12-10 0-4-10-10 0-8-8-6-30z" fill="${b}" ${S}/>
      <circle cx="42" cy="50" r="3.4" fill="#fff" stroke-width="1.4"/>
      <circle cx="58" cy="50" r="3.4" fill="#fff" stroke-width="1.4"/>
      <circle cx="50" cy="40" r="4" fill="${c}" ${SF}/>
      <circle cx="80" cy="76" r="8" fill="none" ${S} stroke="${c}" stroke-width="4"/>
      <path d="M80 84v22M80 96h8M80 104h6" ${S} stroke="${c}" stroke-width="4" fill="none"/>`,
    },
    protecteur: {
        // Masse immobile, racines au sol, feuillage : rien ne le déplace.
        palette: ['#5f7f3a', '#96b45e', '#a8793f'],
        art: (a, b, c) => `
      <path d="M50 108q-24 0-24-6 0-6 8-8h32q8 2 8 8 0 6-24 6z" fill="${c}" ${S}/>
      <path d="M36 94l-10 14M64 94l10 14M50 94v16" ${S} stroke="${c}" stroke-width="5" fill="none"/>
      <path d="M50 20c20 0 32 16 32 34S70 94 50 94 18 74 18 54s12-34 32-34z" fill="${a}" ${S}/>
      <path d="M32 44q10-10 20 0 8-10 18 0-6 18-20 18T32 44z" fill="${b}" ${SF}/>
      <circle cx="42" cy="58" r="3" fill="#2a2a1e"/><circle cx="60" cy="58" r="3" fill="#2a2a1e"/>
      <path d="M44 72q7 6 14 0" fill="none" ${SF}/>`,
    },
    vizir: {
        // Coiffe haute en mitre, bras croisés, œil frontal : le conseiller.
        palette: ['#d8cfe8', '#8b6fc0', '#e9c54a'],
        art: (a, b, c) => `
      <path d="M50 10l16 26H34z" fill="${b}" ${S}/>
      <circle cx="50" cy="26" r="5" fill="${c}" ${SF}/>
      <path d="M34 36h32v10H34z" fill="${c}" ${S}/>
      <circle cx="50" cy="56" r="11" fill="${SKIN}" ${S}/>
      <path d="M50 67c14 0 20 10 20 24l-4 21H34l-4-21c0-14 6-24 20-24z" fill="${a}" ${S}/>
      <path d="M34 84q16 8 32 0" fill="none" ${S} stroke="${b}" stroke-width="5"/>
      <circle cx="45" cy="56" r="1.8" fill="${SKIN_D}"/><circle cx="55" cy="56" r="1.8" fill="${SKIN_D}"/>`,
    },

    // ── Compétences spéciales ─────────────────────────────────────────────
    vieilOurs: {
        // Vieillard voûté, longue barbe, grand bâton. Lecture de berger.
        palette: ['#b98a4e', '#ead9b8', '#8a6a3a'],
        art: (a, b, c) => `
      <path d="M74 20v94" ${S} stroke="${c}" stroke-width="5" fill="none"/>
      <path d="M74 20q10 0 10 9t-10 7" fill="none" ${S} stroke="${c}" stroke-width="5"/>
      <path d="M50 46c14 0 20 10 20 24l-4 42H34l-4-42c0-14 6-24 20-24z" fill="${a}" ${S}/>
      <circle cx="50" cy="36" r="11" fill="${SKIN}" ${S}/>
      <path d="M38 34q12-12 24 0" fill="none" ${S} stroke="${b}" stroke-width="5"/>
      <path d="M40 42q10 4 20 0 2 24-10 30-12-6-10-30z" fill="${b}" ${S}/>
      <circle cx="45" cy="37" r="1.7" fill="${SKIN_D}"/><circle cx="55" cy="37" r="1.7" fill="${SKIN_D}"/>`,
    },
    ourson: {
        // Petit, rond, bas sur pattes : se distingue du Vieil Ours au premier
        // regard, ce qui compte puisqu'il ne participe pas à la capture.
        palette: ['#d9922f', '#f0c489', '#8a5a22'],
        art: (a, b, c) => `
      <circle cx="30" cy="62" r="9" fill="${a}" ${S}/><circle cx="70" cy="62" r="9" fill="${a}" ${S}/>
      <circle cx="30" cy="62" r="4" fill="${b}"/><circle cx="70" cy="62" r="4" fill="${b}"/>
      <path d="M50 54c18 0 28 12 28 28s-12 30-28 30-28-12-28-30 10-28 28-28z" fill="${a}" ${S}/>
      <path d="M50 76c10 0 15 6 15 14s-7 12-15 12-15-4-15-12 5-14 15-14z" fill="${b}" ${SF}/>
      <circle cx="42" cy="72" r="3" fill="${c}"/><circle cx="58" cy="72" r="3" fill="${c}"/>
      <ellipse cx="50" cy="86" rx="5" ry="4" fill="${c}"/>`,
    },
    nemesis: {
        // Hérissée de pointes, masque crânien, lance. Menaçante et immobile.
        palette: ['#b0203f', '#e2566f', '#2b2030'],
        art: (a, b, c) => `
      <path d="M84 16v98" ${S} stroke="${c}" stroke-width="5" fill="none"/>
      <path d="M84 10l7 14h-14z" fill="${b}" ${S}/>
      <path d="M50 44l-26-6 18 18zM50 44l26-6-18 18z" fill="${c}" ${S}/>
      <path d="M50 52c15 0 22 11 22 26l-5 36H33l-5-36c0-15 7-26 22-26z" fill="${a}" ${S}/>
      <path d="M50 24c10 0 16 8 16 17s-7 13-16 13-16-4-16-13 6-17 16-17z" fill="#efe6dc" ${S}/>
      <path d="M42 36q4-4 7 0M51 36q4-4 7 0" fill="none" ${SF}/>
      <circle cx="45" cy="38" r="3" fill="${c}"/><circle cx="55" cy="38" r="3" fill="${c}"/>
      <path d="M44 48h12l-2 6h-8z" fill="${c}" ${SF}/>`,
    },
}

const svg = (id, art, palette) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120" role="img" aria-label="${id}">
  <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${art(...palette).trim()}
  </g>
</svg>
`

/**
 * Un attribut répété dans une même balise casse le parsing XML, et un SVG
 * chargé via <img> est parsé en XML strict : l'image ne s'affiche pas du tout,
 * sans la moindre erreur en console. Ce contrôle transforme cette panne
 * silencieuse en échec bruyant à la génération.
 */
function assertNoDuplicateAttributes(id, markup) {
    for (const tag of markup.match(/<[a-zA-Z]+\b[^>]*>/g) ?? []) {
        const seen = new Set()
        for (const match of tag.matchAll(/\s([a-zA-Z-]+)=/g)) {
            const name = match[1]
            if (seen.has(name)) {
                throw new Error(`${id} : attribut « ${name} » dupliqué dans ${tag.slice(0, 100)}`)
            }
            seen.add(name)
        }
    }
}

await mkdir(OUT, { recursive: true })
const written = []

async function emit(name, art, palette) {
    const markup = svg(name, art, palette)
    assertNoDuplicateAttributes(name, markup)
    await writeFile(join(OUT, `${name}.svg`), markup, 'utf8')
    written.push(name)
}

for (const [id, def] of Object.entries(TOKENS)) {
    await emit(id, def.art, def.palette)
    for (const [suffix, palette] of Object.entries(def.variants ?? {})) {
        await emit(`${id}-${suffix}`, def.art, palette)
    }
}
console.log(`${written.length} jetons écrits dans public/characters/`)
console.log(written.join(', '))
