// Détourage des illustrations générées, de art-raw/ vers public/characters/.
//
//   node scripts/detourer.mjs            toutes les images présentes
//   node scripts/detourer.mjs leader     une seule
//
// Les générateurs d'images ne savent pas écrire de canal alpha : on génère donc
// sur un magenta uni et on le retire ici. Quatre précautions, chacune née d'un
// défaut constaté plutôt que d'un principe :
//
//   1. Le remplissage part des BORDS. Un simple « tout pixel magenta devient
//      transparent » trouerait une cape violette, le violet étant proche du
//      magenta. En ne retirant que la zone connexe au bord, l'intérieur de la
//      figurine est intouchable par construction.
//   2. La couleur de fond est MESURÉE aux quatre coins, pas supposée. Le modèle
//      peint rarement un aplat parfait.
//   3. Le dé-débordement ne s'applique qu'à la BORDURE. Appliqué partout, il
//      mangerait la robe violette du Leader, qui est légitimement riche en
//      rouge et en bleu.
//   4. On ne garde que la plus grande composante connexe. Le filigrane du
//      générateur, dans un coin, survivrait au remplissage et gonflerait le
//      cadrage de la figurine.

import sharp from 'sharp'
import { readdir, mkdir } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENTREE = join(RACINE, 'art-raw')
const SORTIE = join(RACINE, 'public', 'characters')

// Le gabarit reprend exactement le rapport de `.fig` dans HexBoard.vue
// (1.34 × 1.98), pour que `object-fit: contain` ne laisse aucune marge
// parasite. `object-position: bottom` aligne les pieds : chaque figurine est
// donc posée au bas de ce gabarit, et sa taille relative est celle qu'on voit.
const LARGEUR = 512
const HAUTEUR = 756

// Hauteur occupée dans le gabarit, en fraction. C'est la seule façon de garder
// les écarts de taille : redimensionner chacun à la même hauteur rendrait
// l'Ourson aussi grand que le Vieil Ours, or c'est précisément la confusion
// qui coûte des parties — l'Ourson ne participe pas aux captures.
const TAILLES = {
    ourson: 0.45,
    tavernier: 0.80,
    rodeuse: 0.84,
    cavalier: 0.88,
    vieilOurs: 0.90,
    cogneur: 1.0,
    gardeRoyal: 1.0,
    protecteur: 1.0,
}
const TAILLE_DEFAUT = 0.94

// Distance RGB en deçà de laquelle un pixel est considéré comme du fond.
const TOLERANCE = 78
// Tolérance pour les poches de fond ENCLAVÉES, qu'aucun chemin ne relie au
// bord : entre un bras écarté et le buste, sous une jambe levée. Elle est
// volontairement beaucoup plus serrée, puisqu'elle s'applique partout et ne
// bénéficie plus de la protection qu'offre la connexité. Le magenta pur en
// est à moins de 45 ; la cape violette du Leader, elle, en est à environ 200.
const TOLERANCE_ENCLAVE = 45
// Au-delà de cette distance, un pixel de bordure est pleinement opaque ; entre
// les deux, son opacité est proportionnelle. C'est ce dégradé qui évite
// l'escalier sur les contours.
const TOLERANCE_HAUTE = 132

const distance = (r, g, b, f) => Math.hypot(r - f[0], g - f[1], b - f[2])

/** Couleur du fond, prise aux quatre coins : la médiane résiste aux taches. */
function fondMesure(px, w, h) {
    const ech = [[], [], []]
    const coins = [[0, 0], [w - 12, 0], [0, h - 12], [w - 12, h - 12]]
    for (const [cx, cy] of coins) {
        for (let y = cy; y < cy + 12; y++) {
            for (let x = cx; x < cx + 12; x++) {
                const i = (y * w + x) * 4
                ech[0].push(px[i]); ech[1].push(px[i + 1]); ech[2].push(px[i + 2])
            }
        }
    }
    return ech.map(c => c.sort((a, b) => a - b)[c.length >> 1])
}

/** Zone de fond : tout ce qui est proche du fond ET relié au bord de l'image. */
function remplirDepuisLesBords(px, w, h, fond) {
    const fondMask = new Uint8Array(w * h)
    const pile = []
    const pousser = (x, y) => {
        const p = y * w + x
        if (fondMask[p]) return
        const i = p * 4
        if (distance(px[i], px[i + 1], px[i + 2], fond) > TOLERANCE) return
        fondMask[p] = 1
        pile.push(p)
    }
    for (let x = 0; x < w; x++) { pousser(x, 0); pousser(x, h - 1) }
    for (let y = 0; y < h; y++) { pousser(0, y); pousser(w - 1, y) }

    while (pile.length) {
        const p = pile.pop()
        const x = p % w, y = (p / w) | 0
        if (x > 0) pousser(x - 1, y)
        if (x < w - 1) pousser(x + 1, y)
        if (y > 0) pousser(x, y - 1)
        if (y < h - 1) pousser(x, y + 1)
    }

    // Les poches enclavées, que le remplissage ne peut pas atteindre : un bras
    // écarté, une jambe levée, l'anse d'une chope enferment du fond au milieu
    // de la figurine. Elles se retirent à la couleur seule, mais à tolérance
    // serrée — c'est ce qui épargne les étoffes violettes.
    for (let p = 0; p < w * h; p++) {
        if (fondMask[p]) continue
        const i = p * 4
        if (distance(px[i], px[i + 1], px[i + 2], fond) <= TOLERANCE_ENCLAVE) fondMask[p] = 1
    }
    return fondMask
}

/** Plus grande composante connexe du sujet ; le reste est du bruit. */
function plusGrandeComposante(fondMask, w, h) {
    const vu = new Uint8Array(w * h)
    let meilleure = null, meilleureTaille = 0

    for (let depart = 0; depart < w * h; depart++) {
        if (fondMask[depart] || vu[depart]) continue
        const comp = []
        const pile = [depart]
        vu[depart] = 1
        while (pile.length) {
            const p = pile.pop()
            comp.push(p)
            const x = p % w, y = (p / w) | 0
            const voisins = []
            if (x > 0) voisins.push(p - 1)
            if (x < w - 1) voisins.push(p + 1)
            if (y > 0) voisins.push(p - w)
            if (y < h - 1) voisins.push(p + w)
            for (const v of voisins) {
                if (!fondMask[v] && !vu[v]) { vu[v] = 1; pile.push(v) }
            }
        }
        if (comp.length > meilleureTaille) { meilleureTaille = comp.length; meilleure = comp }
    }

    const sujet = new Uint8Array(w * h)
    for (const p of meilleure ?? []) sujet[p] = 1
    return sujet
}

async function detourer(id) {
    const img = sharp(join(ENTREE, `${id}.png`)).ensureAlpha()
    const { width: w, height: h } = await img.metadata()
    const px = await img.raw().toBuffer()

    const fond = fondMesure(px, w, h)
    const fondMask = remplirDepuisLesBords(px, w, h, fond)
    const sujet = plusGrandeComposante(fondMask, w, h)

    // Opacité et dé-débordement. Un pixel du sujet touchant le fond est à
    // cheval sur les deux : son opacité suit sa distance à la couleur de fond,
    // et on y rabat le rouge et le bleu vers le vert, les deux canaux par
    // lesquels le magenta déteint.
    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x, i = p * 4
            if (!sujet[p]) { px[i + 3] = 0; continue }

            const borde =
                (x > 0 && fondMask[p - 1]) || (x < w - 1 && fondMask[p + 1]) ||
                (y > 0 && fondMask[p - w]) || (y < h - 1 && fondMask[p + w])

            if (borde) {
                const d = distance(px[i], px[i + 1], px[i + 2], fond)
                const a = Math.max(0, Math.min(1, (d - TOLERANCE) / (TOLERANCE_HAUTE - TOLERANCE)))
                px[i + 3] = Math.round(a * 255)

                const moy = (px[i] + px[i + 2]) / 2
                if (moy > px[i + 1]) {
                    const exces = (moy - px[i + 1]) * 0.8
                    px[i] = Math.max(0, px[i] - exces)
                    px[i + 2] = Math.max(0, px[i + 2] - exces)
                }
            } else {
                px[i + 3] = 255
            }

            if (px[i + 3] > 8) {
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
            }
        }
    }
    if (maxX < 0) throw new Error(`${id} : rien de gardé, le fond a tout mangé`)

    const facteur = TAILLES[id] ?? TAILLE_DEFAUT
    const decoupe = await sharp(px, { raw: { width: w, height: h, channels: 4 } })
        .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
        // `inside` tient les deux contraintes : une figurine large, comme le
        // Cavalier, est bornée par la largeur et se retrouve donc moins haute,
        // ce qui est exactement sa silhouette.
        .resize({
            width: LARGEUR,
            height: Math.round(HAUTEUR * facteur),
            fit: 'inside',
            withoutEnlargement: false,
        })
        .png()
        .toBuffer()

    const { width: dw, height: dh } = await sharp(decoupe).metadata()
    await sharp({
        create: { width: LARGEUR, height: HAUTEUR, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        // Pieds au bas du gabarit, comme `object-position: bottom` l'attend.
        .composite([{ input: decoupe, left: Math.round((LARGEUR - dw) / 2), top: HAUTEUR - dh }])
        // WebP plutôt que PNG : à qualité visuellement équivalente sur de la
        // peinture, la série passe de 7,7 Mo à 0,8 Mo. Sur un jeu où les dix-
        // neuf figurines se chargent dès la première partie, c'est la
        // différence entre un plateau instantané et un plateau qui se remplit.
        .webp({ quality: 82, alphaQuality: 90, effort: 6 })
        .toFile(join(SORTIE, `${id}.webp`))

    return { id, source: `${w}×${h}`, cadre: `${maxX - minX + 1}×${maxY - minY + 1}`, pose: `${dw}×${dh}` }
}

const demandes = process.argv.slice(2)
const ids = demandes.length
    ? demandes
    : (await readdir(ENTREE)).filter(f => f.endsWith('.png') && !f.startsWith('_')).map(f => basename(f, '.png'))

await mkdir(SORTIE, { recursive: true })
for (const id of ids) {
    const r = await detourer(id)
    console.log(`${r.id.padEnd(14)} ${r.source.padStart(10)} → cadré ${r.cadre.padStart(10)} → posé ${r.pose}`)
}
