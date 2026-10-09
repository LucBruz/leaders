<script setup lang="ts">
// Le plateau. Rendu en perspective CSS 3D, figurines dressées sur leur socle.
//
// Aucune règle ici : le surlignage vient de `store.highlighted`, qui dérive de
// `legalActions`. La vue et la validation ne peuvent donc pas diverger.

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CELLS, cellAt, toPixel, type CellId } from '../../engine/board'
import { CROWN, recruitCells } from '../../engine/layout'
import { occupantOf } from '../../engine/mutate'
import { jetonDe } from '../data/characters.fr'
import { useGameStore } from '../stores/game'

const store = useGameStore()

const SIZE = 46
const CS = 56
const SQ3 = Math.sqrt(3)
const TILT = 50

// ─── Géométrie ────────────────────────────────────────────────────────────────
const points = CELLS.map((_, i) => toPixel(i, SIZE))
const minX = Math.min(...points.map((p) => p.x))
const minY = Math.min(...points.map((p) => p.y))
const width = Math.max(...points.map((p) => p.x)) - minX + CS
const height = Math.max(...points.map((p) => p.y)) - minY + CS

// La clip-path hexagonale encode déjà le facteur √3/2 : son conteneur doit être
// carré, sinon le rapport s'applique deux fois et les cases du bas débordent.
const slab = Math.max(...points.map((p) => p.x)) - minX + CS * 1.62

function xy(cell: CellId) {
    const p = toPixel(cell, SIZE)
    return { x: p.x - minX + CS / 2, y: p.y - minY + CS / 2 }
}

const golds = new Set<CellId>([...recruitCells(0), ...recruitCells(1)])

/**
 * Les cases de départ n'ont aucun rôle une fois la partie lancée : la règle ne
 * les mentionne qu'à la mise en place, et le Leader peut les quitter dès sa
 * première action. On les marque donc tant que leur Leader s'y trouve, puis on
 * les laisse s'effacer — garder un repère permanent laisserait croire à une
 * contrainte qui n'existe pas.
 */
const crownsVisible = computed(() => {
    const set = new Set<CellId>()
    CROWN.forEach((cell, seat) => {
        const occupant = occupantOf(store.state, cell)
        if (occupant === null) return
        const piece = store.state.pieces[occupant]!
        if (piece.character === 'leader' && piece.owner === seat) set.add(cell)
    })
    return set
})

// ─── Rendu ────────────────────────────────────────────────────────────────────
const pieces = computed(() => store.state.pieces)
const highlighted = computed(() => store.highlighted)

/** Position affichée de chaque figurine. Décalée de l'état pendant l'animation. */
const shown = ref<Record<number, { x: number; y: number }>>({})
const boardEl = ref<HTMLElement | null>(null)

// ─── Mise à l'échelle ─────────────────────────────────────────────────────────
// La géométrie est calculée une fois en pixels, à une taille de référence, puis
// l'ensemble de la scène est mis à l'échelle par une seule transformation.
// Tout suit : cases, figurines, ombres, et jusqu'à la hauteur du saut, puisque
// le translateZ de l'animation est lui aussi mis à l'échelle. Recalculer la
// grille à chaque redimensionnement aurait cassé les animations en cours.

const fitEl = ref<HTMLElement | null>(null)
const scale = ref(1)
/** Marge autour du plateau, pour que les figurines ne touchent pas les bords. */
const MARGIN = 72

/**
 * Empreinte verticale réelle du plateau une fois incliné.
 *
 * `height` est la hauteur de la boîte à plat ; après `rotateX(TILT)` le plateau
 * n'occupe plus que sa projection, nettement plus courte. Se fier à la boîte
 * sous-dimensionnait le plateau d'un bon tiers. On ajoute la hauteur des
 * figurines, qui se dressent au-dessus du plan et dépassent vers le haut.
 */
const visualHeight = height * Math.cos((TILT * Math.PI) / 180) + CS * 2.2

function fit() {
    const box = fitEl.value
    if (!box) return
    const available = box.getBoundingClientRect()
    if (available.width < 10 || available.height < 10) return
    const k = Math.min(
        (available.width - MARGIN) / width,
        (available.height - MARGIN) / visualHeight,
    )
    // Plancher pour rester lisible sur petit écran, plafond pour ne pas obtenir
    // des jetons démesurés sur un très grand.
    scale.value = Math.max(0.55, Math.min(k, 2.4))
}

let observer: ResizeObserver | null = null
onMounted(() => {
    fit()
    observer = new ResizeObserver(fit)
    if (fitEl.value) observer.observe(fitEl.value)
})
onBeforeUnmount(() => observer?.disconnect())

function syncInstantly() {
    const next: Record<number, { x: number; y: number }> = {}
    pieces.value.forEach((p, id) => (next[id] = xy(p.cell)))
    shown.value = next
}
onMounted(syncInstantly)

/**
 * Lever, déplacer, reposer. Le plateau étant un plan incliné en 3D, translateZ
 * sort réellement la figurine de ce plan. L'ombre, elle, reste au sol : c'est
 * ce décrochage qui donne la hauteur, bien plus que le déplacement vertical.
 */
const LIFT = 72
const HOP = 620

function hop(id: number, from: { x: number; y: number }, to: { x: number; y: number }) {
    const root = boardEl.value
    if (!root) return
    const piece = root.querySelector<HTMLElement>(`[data-piece="${id}"]`)
    const shadow = root.querySelector<HTMLElement>(`[data-shadow="${id}"]`)
    if (!piece) return

    piece.animate(
        [
            { transform: `translate3d(${from.x}px, ${from.y}px, 0)`, offset: 0, easing: 'cubic-bezier(.3,0,.3,1)' },
            { transform: `translate3d(${from.x}px, ${from.y}px, ${LIFT}px)`, offset: 0.26, easing: 'cubic-bezier(.4,0,.6,1)' },
            { transform: `translate3d(${to.x}px, ${to.y}px, ${LIFT}px)`, offset: 0.7, easing: 'cubic-bezier(.5,0,.4,1)' },
            { transform: `translate3d(${to.x}px, ${to.y}px, -3px)`, offset: 0.9 },
            { transform: `translate3d(${to.x}px, ${to.y}px, 0)`, offset: 1 },
        ],
        { duration: HOP, fill: 'backwards' },
    )
    shadow?.animate(
        [
            { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(1)`, opacity: 0.45, filter: 'blur(5px)', offset: 0 },
            { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(1.5)`, opacity: 0.14, filter: 'blur(13px)', offset: 0.26 },
            { transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(1.5)`, opacity: 0.14, filter: 'blur(13px)', offset: 0.7 },
            { transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(1)`, opacity: 0.45, filter: 'blur(5px)', offset: 1 },
        ],
        { duration: HOP, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'backwards' },
    )
}

// `fill: backwards` plutôt que `forwards` : l'animation part de l'ancienne
// position mais laisse le style inline reprendre la main à la fin, sans qu'il
// faille l'annuler à la main.
watch(
    () => store.state,
    () => {
        const before = shown.value
        const after: Record<number, { x: number; y: number }> = {}
        pieces.value.forEach((p, id) => (after[id] = xy(p.cell)))
        shown.value = after
        requestAnimationFrame(() => {
            for (const [key, to] of Object.entries(after)) {
                const id = Number(key)
                const from = before[id]
                if (from && (from.x !== to.x || from.y !== to.y)) hop(id, from, to)
            }
        })
    },
)

/**
 * Poser une recrue et déplacer une figurine sont deux gestes différents : l'un
 * est une destination libre, l'autre une zone imposée par le plateau. Les
 * confondre sous le même vert laissait croire que l'on peut recruter n'importe
 * où. Le verrou doré ne s'affiche que pendant la pose, et disparaît ensuite.
 */
const placing = computed(() => store.state.phase === 'recruit')

// ─── Interaction ──────────────────────────────────────────────────────────────
function onCell(cell: CellId) {
    // Cliquer une figurine affiche toujours son pouvoir, la sienne comme celle
    // d'en face, qu'on ait la main ou non. Le jeu est à information parfaite :
    // rien ne justifie de cacher une compétence.
    const occupant = occupantOf(store.state, cell)
    if (occupant !== null) store.inspectPiece(occupant)

    if (highlighted.value.has(cell)) {
        store.clickCell(cell)
        return
    }
    if (occupant !== null && store.actionable.has(occupant)) {
        store.select(store.selected === occupant ? null : occupant)
        return
    }
    store.select(null)
}

const seatOf = (id: number) => pieces.value[id]!.owner
const tokenOf = (id: number) => {
    const p = pieces.value[id]!
    return jetonDe(p.character, p.owner, p.slot)
}
</script>

<template>
  <div ref="fitEl" class="fit">
  <div
    class="scene"
    :style="{ '--tilt': TILT + 'deg', '--cs': CS + 'px', transform: `scale(${scale})` }"
  >
    <div
      ref="boardEl"
      class="board"
      :style="{ width: width + 'px', height: height + 'px' }"
    >
      <div class="slab" :style="{ width: slab + 'px', height: slab + 'px' }" />

      <button
        v-for="(cell, i) in CELLS"
        :key="'c' + i"
        class="cell"
        :class="{
          crown: crownsVisible.has(i),
          gold: golds.has(i),
          lit: highlighted.has(i),
          slot: placing && highlighted.has(i),
          taken: store.chosenCells.includes(i),
        }"
        :style="{ transform: `translate3d(${xy(i).x}px, ${xy(i).y}px, 0)` }"
        :aria-label="`case ${cell.q},${cell.r}`"
        @click="onCell(i)"
      />

      <div
        v-for="(p, id) in pieces"
        :key="'s' + id"
        class="shadow"
        :data-shadow="id"
        :style="{ transform: `translate3d(${(shown[id] ?? xy(p.cell)).x}px, ${(shown[id] ?? xy(p.cell)).y}px, 0)` }"
      />

      <div
        v-for="(p, id) in pieces"
        :key="'p' + id"
        class="piece"
        :data-piece="id"
        :class="{ chosen: store.selected === id, ready: store.actionable.has(id) }"
        :style="{ transform: `translate3d(${(shown[id] ?? xy(p.cell)).x}px, ${(shown[id] ?? xy(p.cell)).y}px, 0)` }"
      >
        <div class="socle" :class="'seat' + seatOf(id)" />
        <div class="fig">
          <img :src="`/characters/${tokenOf(id)}.svg`" :alt="p.character" draggable="false">
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* Occupe tout l'espace que la page lui laisse ; la scène est mise à l'échelle
   pour le remplir sans jamais déborder. */
.fit {
  flex: 1; min-width: 0; min-height: 0;
  display: grid; place-items: center;
  width: 100%; height: 100%;
}
.scene { perspective: 1500px; perspective-origin: 50% 42%; }

.board {
  position: relative;
  transform: rotateX(var(--tilt));
  transform-style: preserve-3d;
}

.slab {
  position: absolute; left: 50%; top: 50%;
  margin-left: calc(-1 * v-bind('slab + "px"') / 2);
  margin-top: calc(-1 * v-bind('slab + "px"') / 2);
  background: radial-gradient(ellipse at 38% 28%, #fdfaf3 0%, #efe7d6 45%, #ded2b8 100%);
  clip-path: polygon(100% 50%, 75% 93.3%, 25% 93.3%, 0 50%, 25% 6.7%, 75% 6.7%);
  box-shadow: 0 40px 70px -18px rgba(0, 0, 0, .8);
}
.slab::after {
  content: ""; position: absolute; inset: 14px;
  clip-path: polygon(100% 50%, 75% 93.3%, 25% 93.3%, 0 50%, 25% 6.7%, 75% 6.7%);
  border: 1px solid rgba(120, 100, 60, .26);
  background: linear-gradient(145deg, rgba(255, 255, 255, .3), rgba(170, 145, 100, .07));
}

.cell, .shadow, .piece {
  position: absolute; left: 0; top: 0;
  width: var(--cs); height: var(--cs);
  margin-left: calc(var(--cs) / -2); margin-top: calc(var(--cs) / -2);
}

.cell {
  border-radius: 50%; padding: 0; cursor: default;
  transition: background .5s ease, border-color .5s ease, box-shadow .25s ease;
  background: radial-gradient(circle at 42% 36%, rgba(255,255,255,.55), rgba(190,172,136,.16) 70%, rgba(150,130,95,.24));
  box-shadow: inset 0 2px 4px rgba(120,100,70,.28), inset 0 -1px 2px rgba(255,255,255,.5);
  border: 1px solid rgba(140, 118, 78, .28);
}
.cell.gold {
  border: 1.5px solid #c9a227;
  box-shadow: inset 0 0 0 3px rgba(201,162,39,.15), inset 0 2px 5px rgba(120,100,70,.28);
}
.cell.crown {
  border: 2px solid #c9a227;
  background: radial-gradient(circle at 42% 36%, #fff8e2, #e8d6a4 70%, #d4bd82);
}
.cell.lit {
  cursor: pointer;
  background: radial-gradient(circle at 42% 36%, #d9f1d3, #9cd49a 75%);
  border-color: #5fa75d;
  box-shadow: inset 0 0 0 3px rgba(95,167,93,.3), 0 0 16px rgba(120,210,120,.5);
}
/* Zone de pose imposée : emplacement vide cerclé d'or qui respire, plutôt que
   la cible verte d'un déplacement. On lit « ça va ici », pas « va là ». */
.cell.slot {
  background: radial-gradient(circle at 42% 36%, rgba(255, 246, 214, .95), rgba(233, 206, 140, .5) 72%);
  border: 2px dashed #c9a227;
  box-shadow: inset 0 0 0 4px rgba(201, 162, 39, .12), 0 0 20px rgba(226, 183, 64, .55);
  animation: respire 1.7s ease-in-out infinite;
}
@keyframes respire {
  0%, 100% { box-shadow: inset 0 0 0 4px rgba(201,162,39,.12), 0 0 14px rgba(226,183,64,.4); }
  50%      { box-shadow: inset 0 0 0 4px rgba(201,162,39,.26), 0 0 26px rgba(226,183,64,.75); }
}
@media (prefers-reduced-motion: reduce) { .cell.slot { animation: none; } }

/* Première case déjà choisie du Vieil Ours, en attendant la seconde. */
.cell.taken {
  background: radial-gradient(circle at 42% 36%, #ffe9b0, #e8c46a 75%);
  border: 2px solid #c9a227;
  box-shadow: inset 0 0 0 4px rgba(201, 162, 39, .3);
  animation: none;
}

.shadow {
  border-radius: 50%; background: rgba(58, 44, 24, .45);
  filter: blur(5px); pointer-events: none;
}

.piece { transform-style: preserve-3d; pointer-events: none; }
.socle {
  position: absolute; left: 5%; top: 16%; width: 90%; height: 68%;
  border-radius: 50%;
  background: linear-gradient(160deg, #cfe2f6, #8fb6dd 55%, #6f97c2);
  border: 1px solid rgba(45, 75, 110, .5);
  box-shadow: 0 2px 0 #5c82ab;
}
.socle.seat1 {
  background: linear-gradient(160deg, #f6d9d9, #d99a9a 55%, #bd7676);
  border-color: rgba(130, 60, 60, .5); box-shadow: 0 2px 0 #a86060;
}
/* La silhouette se redresse par contre-rotation exacte de l'inclinaison.
   Pas de filter ici : drop-shadow aplatit le contexte 3D sur certains
   navigateurs, et l'ombre est de toute façon un élément séparé. */
.fig {
  position: absolute; left: 50%; bottom: 40%;
  width: calc(var(--cs) * 1.34); height: calc(var(--cs) * 1.98);
  margin-left: calc(var(--cs) * -.67);
  transform: rotateX(calc(var(--tilt) * -1));
  transform-origin: 50% 100%;
}
.fig img { width: 100%; height: 100%; display: block; object-fit: contain; object-position: bottom; }

.piece.ready .socle { box-shadow: 0 2px 0 #5c82ab, 0 0 0 2px rgba(255, 255, 255, .55); }
.piece.ready.seat1 .socle { box-shadow: 0 2px 0 #a86060, 0 0 0 2px rgba(255, 255, 255, .55); }
.piece.chosen .socle { box-shadow: 0 2px 0 #3f7a3d, 0 0 0 3px #7fc87c, 0 0 18px rgba(120, 210, 120, .7); }
</style>
