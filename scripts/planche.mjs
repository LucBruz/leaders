// Planche de contact des illustrations détourées.
//
//   node scripts/planche.mjs
//
// Les défauts du détourage — un liseré magenta, une ombre peinte restée
// collée aux pieds, une figurine à la mauvaise échelle — ne se voient pas en
// regardant les fichiers un par un sur fond clair. Les poser côte à côte sur
// le fond du plateau, à leur taille relative réelle, les rend évidents d'un
// seul coup d'œil.

import sharp from 'sharp'
import { readdir } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER = join(RACINE, 'public', 'characters')

const CASE_L = 150
const CASE_H = 222
const COLONNES = 7
const FOND = { r: 27, g: 32, b: 41, alpha: 1 }

const ids = (await readdir(DOSSIER)).filter(f => f.endsWith('.png')).map(f => basename(f, '.png')).sort()
if (!ids.length) throw new Error('aucune illustration détourée')

const lignes = Math.ceil(ids.length / COLONNES)
const vignettes = await Promise.all(ids.map(async (id, n) => ({
    input: await sharp(join(DOSSIER, `${id}.png`)).resize({ width: CASE_L, height: CASE_H, fit: 'inside' }).png().toBuffer(),
    left: (n % COLONNES) * CASE_L,
    top: ((n / COLONNES) | 0) * CASE_H,
})))

const sortie = join(RACINE, 'art-raw', '_planche.png')
await sharp({ create: { width: COLONNES * CASE_L, height: lignes * CASE_H, channels: 4, background: FOND } })
    .composite(vignettes)
    .png()
    .toFile(sortie)

console.log(`${ids.length} illustrations → ${sortie}`)
console.log(ids.join(', '))
