# Déploiement

Le jeu tourne sur le serveur OVH, derrière nginx, géré par pm2 — même dispositif
que `encore-game`, qui occupe déjà le port 3001. Leaders prend le **3003**.

| | |
|---|---|
| Dépôt | `LucBruz/leaders` |
| Dossier serveur | `/home/projets/leaders` |
| Nom pm2 | `leaders` |
| Port | `3003` |
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

Les cinq sont renseignés. **Un secret GitHub est en écriture seule** : une fois
posé, plus personne ne peut le relire, pas même son auteur. Si l'un d'eux est
perdu, il faut le reconstituer à la source, jamais le « récupérer ».

| Secret | Valeur |
|---|---|
| `SSH_HOST` | `188.245.245.42` — figure déjà en clair dans le `known_hosts` du workflow |
| `SSH_USER` | `root` — déduit du `--chown=root:root` du rsync |
| `SSH_KEY` | clé privée `~/.ssh/deploy/deploy_leaders` |
| `NUXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NUXT_PUBLIC_SUPABASE_KEY` | clé publishable |

### Clé de déploiement

Le poste suit une convention : **une clé par projet**, dans `~/.ssh/deploy/`,
nommée `gha-deploy-<projet>`. Chaque projet est ainsi révocable seul, sans
toucher aux autres.

```
~/.ssh/deploy/deploy_leaders       # privée → secret SSH_KEY
~/.ssh/deploy/deploy_leaders.pub   # publique → authorized_keys du serveur
```

Sans passphrase, comme l'exige une intégration continue.

Pour poser le secret sans jamais afficher la clé, la redirection suffit :

```bash
gh secret set SSH_KEY --repo LucBruz/leaders < ~/.ssh/deploy/deploy_leaders
```

Pour en régénérer une :

```bash
ssh-keygen -t ed25519 -C "gha-deploy-leaders" -f ~/.ssh/deploy/deploy_leaders -N ""
```

La publique doit alors être réinstallée dans `authorized_keys` du serveur, et
l'ancienne ligne retirée.

---

## Mise en place du serveur, une seule fois

### 1. Vérifier Node

```bash
node -v   # doit afficher v22 ou plus
```

Nuxt 4.5.2 s'appuie sur `Set.prototype.difference`, absente avant Node 22.

### 2. Autoriser la clé de déploiement et créer le dossier

Depuis le poste, qui a déjà un accès SSH au serveur.

La clé publique est envoyée **par un tube**, et non insérée dans la commande :
une substitution comme `$(cat …)` est du shell POSIX et ne s'exécute pas sous
`cmd.exe`, qui transmettrait alors la chaîne littérale au serveur. Le tube,
lui, fonctionne partout.

`cmd.exe` :

```bat
type %USERPROFILE%\.ssh\deploy\deploy_leaders.pub | ssh root@188.245.245.42 "mkdir -p ~/.ssh /home/projets/leaders && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

Shell POSIX (Git Bash, WSL, Linux, macOS) :

```bash
cat ~/.ssh/deploy/deploy_leaders.pub | ssh root@188.245.245.42 "mkdir -p ~/.ssh /home/projets/leaders && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

Puis vérifier que la clé ouvre bien la porte :

```bat
ssh -i %USERPROFILE%\.ssh\deploy\deploy_leaders -o IdentitiesOnly=yes root@188.245.245.42 "echo acces ok"
```

Elle doit répondre `acces ok` **sans demander de mot de passe**. Si un mot de
passe est demandé, le workflow échouera exactement pareil : c'est ce test qui
fait foi, pas la commande d'installation.

Si une tentative précédente a inséré une ligne parasite dans
`authorized_keys` — typiquement un `$(cat …)` non substitué — la retirer :

```bash
ssh root@188.245.245.42 "sed -i '/[$](cat/d' ~/.ssh/authorized_keys"
```

Si l'utilisateur du serveur n'est pas `root`, corriger le secret `SSH_USER`
en conséquence.

### 3. Premier envoi

Lancer le workflow depuis l'onglet *Actions* du dépôt, bouton *Run workflow*.

Il va réussir l'envoi puis **échouer sur `pm2 reload`** : l'application n'est pas
encore déclarée dans pm2. C'est attendu, et sans conséquence — le `.output/` est
en place sur le serveur.

### 4. Déclarer l'application dans pm2

Le fichier est versionné dans `deploy/ecosystem.config.cjs`. Il se dépose à la
racine du dossier applicatif, donc en dehors du `.output/` que rsync remplace à
chaque déploiement : il survit aux mises à jour.

Envoi par tube, pour éviter toute question de guillemets :

```bat
type deploy\ecosystem.config.cjs | ssh root@188.245.245.42 "cat > /home/projets/leaders/ecosystem.config.cjs"
```

Puis démarrage et contrôle en une seule commande :

```bat
ssh root@188.245.245.42 "node -v && cd /home/projets/leaders && pm2 start ecosystem.config.cjs && pm2 save && sleep 3 && curl -s http://localhost:3003/ | grep -o supabase.co | head -1"
```

Trois choses doivent apparaître : une version de Node **22 ou plus**, le
démarrage de pm2, et la ligne `supabase.co`. Si cette dernière manque,
l'application tourne sans sa configuration et son mode en ligne est muet.

### 5. nginx

```nginx
server {
    server_name leaders.lucbruzzone.com;

    location / {
        proxy_pass http://127.0.0.1:3003;
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
