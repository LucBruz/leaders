export default defineNuxtConfig({
  compatibilityDate: '2026-10-08',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  // `ssr: false` produit une page blanche avec Nuxt 4.5.2 et Vite 8.3.3 —
  // le rendu échoue sur « Either manifest or precomputed data must be
  // provided ». On garde donc le rendu serveur, qui fonctionne.
  runtimeConfig: {
    public: {
      // Vides par défaut : sans elles, le jeu bascule sur le transport
      // BroadcastChannel, qui ne relie que deux onglets du même navigateur.
      supabaseUrl: '',
      supabaseKey: '',
    },
  },
})
