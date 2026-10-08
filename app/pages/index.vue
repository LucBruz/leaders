<script setup lang="ts">
// Partie locale sur un même écran. Premier jalon jouable, et meilleur banc de
// test manuel du moteur avant de brancher le réseau.
import { useGameStore } from '../stores/game'

const store = useGameStore()
useHead({ title: 'Leaders' })

/**
 * Un salon est un identifiant aléatoire, et la graine de la pioche voyage dans
 * le lien : sans serveur, c'est le lien lui-même qui porte tout ce dont les deux
 * clients ont besoin pour dériver exactement la même partie.
 */
function creerSalon() {
    const salon = Math.random().toString(36).slice(2, 8)
    const graine = Math.floor(Math.random() * 65536)
    return navigateTo(`/partie/${salon}?siege=0&g=${graine}`)
}
</script>

<template>
  <main class="page">
    <div class="stage">
      <div class="top">
        <h1>Leaders</h1>
        <button class="lien" @click="creerSalon">Créer une partie en ligne</button>
      </div>
      <HexBoard />
    </div>

    <SidePanel />

    <!-- Désambiguïsation : plusieurs actions mènent à la même case. -->
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
.stage { display: flex; flex-direction: column; align-items: center; gap: 26px; }
.top { display: flex; align-items: center; gap: 18px; }
h1 {
  font-size: 13px; letter-spacing: .3em; text-transform: uppercase;
  opacity: .45; margin: 0; font-weight: 600;
}
.lien {
  background: rgba(255, 255, 255, .08); color: inherit; font-family: inherit;
  border: 1px solid rgba(255, 255, 255, .18); border-radius: 999px;
  padding: 7px 15px; font-size: 12px; cursor: pointer;
}
.lien:hover { background: rgba(255, 255, 255, .15); }

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
