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

// Passer d'un salon à un autre — en rejoignant une revanche, typiquement —
// réutiliserait le composant : `onMounted` ne se rejouerait pas, et la page
// resterait sur l'état du salon précédent, siège compris. La clé force un
// remontage complet à chaque identifiant.
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const store = useGameStore()

const roomId = String(route.params.id)

/**
 * Siège effectivement occupé, décidé par la base et non par l'URL.
 *
 * `?siege=` reste accepté, mais uniquement pour le transport de secours entre
 * deux onglets, quand aucun projet Supabase n'est configuré. En ligne, c'est
 * `claim_seat` qui tranche : sinon deux personnes ouvrent le même siège.
 */
const seat = ref<Seat | null>(null)
const seatFromUrl = computed<Seat | null>(() => {
    const value = route.query.siege
    return value === '0' ? 0 : value === '1' ? 1 : null
})
// La graine voyage dans le lien : les deux clients doivent dériver la même
// pioche, et il n'y a pas de serveur pour la leur donner.
const seed = computed(() => Number(route.query.g ?? 1) || 1)

const ready = ref(false)
const erreur = ref<string | null>(null)
const lienAdverse = ref('')
const distant = ref(false)

const config = useRuntimeConfig()

const revanche = ref<string | null>(null)
let canalRevanche: { unsubscribe: () => void } | null = null

onMounted(async () => {
    try {
        const svc = await import('../../services/supabase')
        const db = svc.supabase(config.public.supabaseUrl, config.public.supabaseKey)

        let graine = seed.value
        let mode: 'classic' | 'strategist' = 'classic'
        let transport

        if (db) {
            // La graine vient de la base, pas du lien : c'est elle qui fait foi.
            const room = await svc.loadRoom(db, roomId)
            if (!room) {
                erreur.value = "Ce salon n'existe pas."
                return
            }
            graine = room.seed
            mode = room.mode
            // Le premier arrivé prend le siège 0, le second le siège 1, les
            // suivants regardent. Recharger la page rend le même siège.
            seat.value = await svc.claimSeat(db, roomId, svc.clientToken())
            if (room.rematch_id) revanche.value = room.rematch_id
            canalRevanche = svc.watchRematch(db, roomId, (id) => (revanche.value = id))
            const { SupabaseTransport } = await import('../../services/supabaseTransport')
            transport = new SupabaseTransport(db, roomId)
            distant.value = true
        } else {
            // Sans projet configuré : deux onglets du même navigateur, et c'est
            // alors l'URL qui porte le siège.
            seat.value = seatFromUrl.value
            const { BroadcastTransport } = await import('../../services/transport')
            transport = new BroadcastTransport(roomId)
        }

        await store.connect({ transport, seat: seat.value, seed: graine, mode })
        ready.value = true
        lienAdverse.value = distant.value
            ? `${location.origin}/partie/${roomId}`
            : `${location.origin}/partie/${roomId}?siege=${seat.value === 0 ? 1 : 0}&g=${graine}`
    } catch (error) {
        erreur.value = (error as Error).message
    }
})

/** Propose une revanche, ou rejoint celle que l'adversaire vient de proposer. */
async function jouerRevanche() {
    const svc = await import('../../services/supabase')
    const db = svc.supabase(config.public.supabaseUrl, config.public.supabaseKey)
    if (!db) return
    const cible =
        revanche.value ??
        (await svc.proposeRematch(db, roomId, Math.floor(Math.random() * 65536)))
    if (cible) await navigateTo(`/partie/${cible}`)
}
onBeforeUnmount(() => {
    canalRevanche?.unsubscribe()
    void store.disconnect()
})

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
        <span v-if="ready && !distant" class="turn local">même navigateur</span>
        <span v-if="ready" class="turn" :class="{ mine: store.canAct }">
          {{ store.canAct ? 'À vous de jouer' : "En attente de l'adversaire" }}
        </span>
      </div>

      <!-- La revanche est portée par la base, donc les DEUX joueurs la voient,
           pas seulement celui qui a cliqué. -->
      <div v-if="ready && distant && (store.over || revanche)" class="revanche">
        <span>{{ revanche ? 'Une revanche vous attend.' : 'Partie terminée.' }}</span>
        <button @click="jouerRevanche">
          {{ revanche ? 'Rejoindre la revanche' : 'Proposer une revanche' }}
        </button>
      </div>

      <HexBoard v-if="ready" />
      <p v-else-if="erreur" class="loading erreur">{{ erreur }}</p>
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
.turn.local { color: #e0c070; opacity: .7; }

.loading { opacity: .5; font-size: 13px; padding: 80px 0; }

.revanche {
  display: flex; align-items: center; gap: 12px; font-size: 13px;
  background: rgba(127, 200, 124, .12); border: 1px solid rgba(127, 200, 124, .35);
  border-radius: 999px; padding: 8px 10px 8px 18px;
}
.revanche button {
  background: rgba(255, 255, 255, .12); color: inherit; font-family: inherit;
  border: 1px solid rgba(255, 255, 255, .25); border-radius: 999px;
  padding: 6px 14px; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.revanche button:hover { background: rgba(255, 255, 255, .2); }
.erreur { color: #e6a0a0; opacity: .9; }

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
