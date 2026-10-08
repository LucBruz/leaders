<script setup lang="ts">
// Partie en ligne. Le salon est identifié par l'URL, le siège par la requête.
//
// Transport actuel : BroadcastChannel, donc deux onglets du MÊME navigateur.
// C'est volontaire — cela exerce tout le protocole sans dépendre d'une base, et
// l'adaptateur Supabase se substituera ici sans rien changer d'autre.

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Seat } from '../../../engine/types'
import { useGameStore } from '../../stores/game'

const route = useRoute()
const store = useGameStore()

const roomId = String(route.params.id)
const seat = computed<Seat | null>(() => {
    const value = route.query.siege
    return value === '0' ? 0 : value === '1' ? 1 : null
})
// La graine voyage dans le lien : les deux clients doivent dériver la même
// pioche, et il n'y a pas de serveur pour la leur donner.
const seed = computed(() => Number(route.query.g ?? 1) || 1)

const ready = ref(false)
const lienAdverse = ref('')

onMounted(async () => {
    await store.connect({ roomId, seat: seat.value, seed: seed.value })
    ready.value = true
    const autre = seat.value === 0 ? 1 : 0
    lienAdverse.value = `${location.origin}/partie/${roomId}?siege=${autre}&g=${seed.value}`
})
onBeforeUnmount(() => void store.disconnect())

const copie = ref(false)
async function copier() {
    try {
        await navigator.clipboard.writeText(lienAdverse.value)
        copie.value = true
        setTimeout(() => (copie.value = false), 1600)
    } catch {
        copie.value = false
    }
}

useHead({ title: `Leaders — salon ${roomId}` })
</script>

<template>
  <main class="page">
    <div class="stage">
      <div class="bar">
        <span class="tag" :class="'seat' + (seat ?? 'spec')">
          {{ seat === 0 ? 'Vous êtes Bleu' : seat === 1 ? 'Vous êtes Rouge' : 'Spectateur' }}
        </span>
        <span v-if="ready" class="turn" :class="{ mine: store.canAct }">
          {{ store.canAct ? 'À vous de jouer' : "En attente de l'adversaire" }}
        </span>
      </div>

      <HexBoard v-if="ready" />
      <p v-else class="loading">Connexion au salon…</p>

      <div v-if="seat !== null" class="share">
        <span>Lien pour l'adversaire</span>
        <code>{{ lienAdverse }}</code>
        <button @click="copier">{{ copie ? 'Copié' : 'Copier' }}</button>
      </div>
    </div>

    <SidePanel v-if="ready" />

    <div v-if="store.choice" class="overlay" @click.self="store.choice = null">
      <div class="dialog">
        <h2>Quelle action ?</h2>
        <button
          v-for="(option, i) in store.choice.options"
          :key="i"
          class="opt"
          @click="store.play(option.action)"
        >
          {{ option.label }}
        </button>
        <button class="opt cancel" @click="store.choice = null">Annuler</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page {
  min-height: 100%; display: flex; gap: 40px; align-items: center;
  justify-content: center; padding: 28px 26px; flex-wrap: wrap;
}
.stage { display: flex; flex-direction: column; align-items: center; gap: 22px; }

.bar { display: flex; gap: 12px; align-items: center; }
.tag {
  font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
  padding: 4px 11px; border-radius: 999px; background: rgba(255, 255, 255, .08);
}
.tag.seat0 { background: rgba(143, 182, 221, .3); }
.tag.seat1 { background: rgba(217, 154, 154, .3); }
.turn { font-size: 12px; opacity: .45; }
.turn.mine { opacity: .9; color: #9cd49a; }

.loading { opacity: .5; font-size: 13px; padding: 80px 0; }

.share {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 11px; opacity: .55; max-width: 520px;
}
.share code {
  background: rgba(255, 255, 255, .07); padding: 4px 9px; border-radius: 6px;
  font-size: 11px; overflow-wrap: anywhere;
}
.share button {
  background: rgba(255, 255, 255, .09); color: inherit; font-family: inherit;
  border: 1px solid rgba(255, 255, 255, .2); border-radius: 999px;
  padding: 4px 12px; font-size: 11px; cursor: pointer;
}

.overlay {
  position: fixed; inset: 0; display: grid; place-items: center;
  background: rgba(10, 12, 16, .66); backdrop-filter: blur(3px); z-index: 20;
}
.dialog {
  background: #1d222b; border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 14px; padding: 18px; width: 290px;
  display: flex; flex-direction: column; gap: 8px;
}
.dialog h2 {
  font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  opacity: .45; margin: 0 0 4px; font-weight: 600;
}
.opt {
  padding: 10px 14px; border-radius: 9px; cursor: pointer; text-align: left;
  background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .14);
  color: inherit; font-family: inherit; font-size: 13px;
}
.opt:hover { background: rgba(255, 255, 255, .15); }
.cancel { opacity: .5; text-align: center; }
</style>
