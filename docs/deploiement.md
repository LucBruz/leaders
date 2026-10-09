# Déploiement

Le jeu tourne sur le serveur OVH, derrière nginx, géré par pm2 — même dispositif
que `encore-game`, qui occupe déjà le port 3001. Leaders prend le **3002**.

| | |
|---|---|
| Dépôt | `LucBruz/leaders` |
| Dossier serveur | `/home/projets/leaders` |
| Nom pm2 | `leaders` |
| Port | `3002` |
| Adresse | `leaders.lucbruzzone.com` |

Chaque poussée sur `master` déclenche `.github/workflows/deploy.yml` : tests,
build, envoi du `.output/` par rsync, bascule atomique, `pm2 reload`,
vérification, et **rollback automatique** si quelque chose échoue.

---

## Un point à comprendre avant de commencer

La configuration Supabase **n'est pas incorporée au build**. Nuxt lit
`runtimeConfig` au démarrage du serveur, pas à la compilation. Le serveur de
production doit donc avoir `NUXT_PUBLIC_SUPABASE_URL` et
`NUXT_PUBLIC_SUPABASE_KEY` dans son environnement.

Sans elles, le jeu démarre, le plateau s'affiche, les parties locales
fonctionnent — mais le mode en ligne bascule silencieusement sur
`BroadcastChannel`, qui ne relie que deux onglets du même navigateur. Aucune
erreur visible. C'est pour cette raison que le workflow vérifie, **après**
redémarrage, que l'URL Supabase figure bien dans le HTML servi.

---

## Secrets du dépôt

Cinq secrets, dans *Settings → Secrets and variables → Actions*.

| Secret | Valeur |
|---|---|
| `SSH_HOST` | identique à `encore-game` |
| `SSH_USER` | identique à `encore-game` |
| `SSH_KEY` | identique à `encore-game` — clé privée, à recopier directement, sans passer par un tiers |
| `NUXT_PUBLIC_SUPABASE_URL` | déjà renseigné |
| `NUXT_PUBLIC_SUPABASE_KEY` | déjà renseigné |

---

## Mise en place du serveur, une seule fois

### 1. Vérifier Node

```bash
node -v   # doit afficher v22 ou plus
```

Nuxt 4.5.2 s'appuie sur `Set.prototype.difference`, absente avant Node 22.

### 2. Créer le dossier

```bash
mkdir -p /home/projets/leaders
```

### 3. Premier envoi

Lancer le workflow depuis l'onglet *Actions* du dépôt, bouton *Run workflow*.

Il va réussir l'envoi puis **échouer sur `pm2 reload`** : l'application n'est pas
encore déclarée dans pm2. C'est attendu, et sans conséquence — le `.output/` est
en place sur le serveur.

### 4. Déclarer l'application dans pm2

Créer `/home/projets/leaders/ecosystem.config.cjs`. Le fichier vit à la racine
du dossier, donc en dehors du `.output/` que rsync remplace à chaque
déploiement : il survit aux mises à jour.

```js
module.exports = {
  apps: [
    {
      name: 'leaders',
      script: '.output/server/index.mjs',
      cwd: '/home/projets/leaders',
      env: {
        PORT: 3002,
        NUXT_PUBLIC_SUPABASE_URL: 'https://qzhrlrnvbuocwcxaluxl.supabase.co',
        NUXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_6H_90HdZ4s1I4Qms07S16w_wxFKuY3n',
      },
    },
  ],
}
```

Puis :

```bash
cd /home/projets/leaders
pm2 start ecosystem.config.cjs
pm2 save
curl -s http://localhost:3002/ | grep -o 'supabase\.co'   # doit renvoyer une ligne
```

Si le `grep` ne renvoie rien, l'application tourne sans sa configuration : relire
l'étape précédente.

### 5. nginx

```nginx
server {
    server_name leaders.lucbruzzone.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 80;
}
```

```bash
nginx -t && systemctl reload nginx
certbot --nginx -d leaders.lucbruzzone.com
```

Le DNS doit pointer `leaders.lucbruzzone.com` vers le serveur avant certbot.

Note : le temps réel ne passe pas par nginx. Le navigateur ouvre sa WebSocket
directement vers Supabase. Les en-têtes `Upgrade` ci-dessus ne servent donc à
rien aujourd'hui, mais ne coûtent rien et éviteront une mauvaise surprise si un
canal serveur apparaît un jour.

---

## Ensuite

Tout est automatique. Une poussée sur `master` déploie. En cas d'échec, le
workflow remet en place la version précédente et l'indique dans son journal.

Pour revenir en arrière à la main :

```bash
cd /home/projets/leaders
rm -rf .output && mv .output.old .output && pm2 reload leaders --update-env
```
