<script setup lang="ts">
// Panneau latéral : qui joue, marché de recrutement, main, journal.

import { computed } from 'vue'
import { FR, jetonDe, nomDe } from '../data/characters.fr'
import { useGameStore } from '../stores/game'

const store = useGameStore()

const nomSiege = (seat: 0 | 1 | null) => (seat === 0 ? 'Bleu' : seat === 1 ? 'Rouge' : '—')

const phaseLabel = computed(() => {
    const s = store.state
    if (s.winner !== null) return `Victoire ${nomSiege(s.winner)}`
    if (s.pending) return 'Réaction de la Némésis'
    return s.phase === 'recruit' ? 'Recrutement' : 'Actions'
})

const canEnd = computed(() => store.legal.some((a) => a.t === 'endActions'))
const mustSkip = computed(() => store.legal.some((a) => a.t === 'skipRecruit'))

function endActions() {
    const action = store.legal.find((a) => a.t === 'endActions')
    if (action) store.play(action)
}
function skipRecruit() {
    const action = store.legal.find((a) => a.t === 'skipRecruit')
    if (action) store.play(action)
}

const hand = (seat: 0 | 1) => store.state.hands[seat].filter((c) => c !== 'leader')
</script>

<template>
  <aside class="panel">
    <header class="head" :class="'seat' + (store.decider ?? 0)">
      <div class="who">Au tour de <b>{{ nomSiege(store.decider) }}</b></div>
      <div class="phase">{{ phaseLabel }}</div>
    </header>

    <!-- Réaction forcée : on explique, sinon le joueur ne comprend pas
         pourquoi la main lui revient au milieu du tour adverse. -->
    <p v-if="store.state.pending" class="note">
      Le Leader adverse a bougé. Votre Némésis <b>doit</b> se déplacer.
      Choisissez une case verte.
    </p>

    <section v-if="store.state.phase === 'recruit' && !store.over" class="block">
      <h2>Marché</h2>
      <p v-if="mustSkip" class="note">
        Aucune case de Recrutement disponible de votre côté.
      </p>
      <button v-if="mustSkip" class="action" @click="skipRecruit">Passer le recrutement</button>
      <ul v-else class="market">
        <li v-for="c in store.state.market" :key="c">
          <button
            class="card"
            :class="{ picked: store.recruitPick === c, dim: !store.recruitable.has(c) }"
            :disabled="!store.recruitable.has(c)"
            @click="store.pickCharacter(store.recruitPick === c ? null : c)"
          >
            <img :src="`/characters/${jetonDe(c, store.decider ?? 0)}.svg`" :alt="nomDe(c)">
            <span class="nom">{{ nomDe(c) }}</span>
            <span class="txt">{{ FR[c].texte }}</span>
          </button>
        </li>
      </ul>
      <p v-if="store.recruitPick" class="note">
        Posez la figurine sur une case dorée surlignée.
        <template v-if="store.chosenCells.length"> Encore une case à choisir.</template>
      </p>
    </section>

    <section v-else-if="!store.over" class="block">
      <h2>Actions</h2>
      <p class="note">
        Cliquez une figurine prête, puis une case verte.
      </p>
      <button class="action" :disabled="!canEnd" @click="endActions">
        Terminer mes actions
      </button>
    </section>

    <!-- En ligne, recommencer ne peut pas être une affaire locale : remettre
         l'état à zéro ici désynchroniserait aussitôt les deux joueurs. La
         revanche passe par la base, et son bouton vit sur la page de salon. -->
    <section v-if="store.over && !store.online" class="block">
      <button class="action" @click="store.reset()">Nouvelle partie</button>
    </section>

    <section class="block">
      <h2>Équipes</h2>
      <div v-for="seat in ([0, 1] as const)" :key="seat" class="team">
        <span class="tag" :class="'seat' + seat">{{ nomSiege(seat) }}</span>
        <span v-if="!hand(seat).length" class="empty">aucune recrue</span>
        <span v-for="c in hand(seat)" :key="c" class="chip" :title="FR[c].texte">{{ nomDe(c) }}</span>
      </div>
    </section>

    <section class="block grow">
      <h2>Journal</h2>
      <ol class="log">
        <li v-for="(line, i) in store.log" :key="i">{{ line }}</li>
      </ol>
    </section>
  </aside>
</template>

<style scoped>
.panel {
  width: 310px; display: flex; flex-direction: column; gap: 14px;
  color: #e8e3d9; font-size: 13px;
}
.head {
  border-radius: 12px; padding: 12px 14px;
  background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .12);
  border-left: 4px solid #8fb6dd;
}
.head.seat1 { border-left-color: #d99a9a; }
.who { font-size: 14px; }
.phase { opacity: .55; margin-top: 2px; letter-spacing: .08em; text-transform: uppercase; font-size: 11px; }

h2 { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; opacity: .45; margin: 0 0 8px; font-weight: 600; }
.block { background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08); border-radius: 12px; padding: 12px 14px; }
.grow { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.note { margin: 0 0 10px; opacity: .6; line-height: 1.5; }

.market { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.card {
  width: 100%; display: grid; grid-template-columns: 38px 1fr; gap: 4px 10px;
  align-items: start; text-align: left; cursor: pointer;
  background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 10px; padding: 8px 10px; color: inherit; font-family: inherit;
}
.card:hover:not(:disabled) { background: rgba(255, 255, 255, .11); }
.card.picked { border-color: #7fc87c; background: rgba(127, 200, 124, .16); }
.card.dim { opacity: .35; cursor: not-allowed; }
.card img { grid-row: span 2; width: 38px; height: 46px; object-fit: contain; }
.nom { font-weight: 600; font-size: 13px; }
.txt { font-size: 11px; opacity: .55; line-height: 1.45; }

.action {
  width: 100%; padding: 9px 14px; border-radius: 999px; cursor: pointer;
  background: rgba(255, 255, 255, .09); color: inherit; font-family: inherit; font-size: 13px;
  border: 1px solid rgba(255, 255, 255, .2);
}
.action:hover:not(:disabled) { background: rgba(255, 255, 255, .16); }
.action:disabled { opacity: .35; cursor: not-allowed; }

.team { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-bottom: 7px; }
.tag { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; }
.tag.seat0 { background: rgba(143, 182, 221, .3); }
.tag.seat1 { background: rgba(217, 154, 154, .3); }
.chip { background: rgba(255, 255, 255, .09); border-radius: 999px; padding: 2px 9px; font-size: 11px; }
.empty { opacity: .35; font-size: 11px; }

.log { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; font-size: 12px; }
.log li { padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, .06); opacity: .75; }
.log li:first-child { opacity: 1; }
</style>
