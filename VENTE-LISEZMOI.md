# YakFlow · version en ligne (depuis le 7 octobre 2026)

- **Studio** : https://yakflow.netlify.app/studio (`public/studio.html`). Licence signée délivrée une fois par mois, liée au navigateur.
- **Relais Agnes** : Cloudflare Worker (`cloudflare/worker.js`), à mettre en ligne une fois : voir `CLOUDFLARE.md`, puis renseigner `workerUrl` dans `public/yakflow-config.js`.
- **Ponts ChatGPT et Grok** : un seul script Tampermonkey, `public/yakflow-connect.user.js`. Les onglets se parlent dans le navigateur : aucune requête serveur.
- **Drive** : dans les Réglages du studio, le client choisit une fois son dossier Google Drive (Chrome ou Edge).

La version locale (`app-locale/`, zip) reste dans le dépôt mais n'est plus mise en avant.

# YakFlow · vente de la version locale (Netlify)

Le client paie sur Stripe, arrive sur `yakflow.netlify.app/merci` qui lui donne son code, télécharge YakFlow et l'active.
YakFlow tourne ensuite sur son ordinateur. Il contacte Netlify **une fois par mois** pour renouveler sa licence :
une lecture Firestore par client et par mois, donc très loin du quota gratuit.

## Fichiers

- `app-locale/` : l'application vendue. `licence.py` vérifie la licence signée, hors ligne.
- `netlify/functions/licence.mjs` : activation et renouvellement. `claim.mjs` : code après paiement. `admin-license.mjs` : page admin.
- `public/index.html` : page de vente. `public/merci.html` : page après paiement. `public/telecharger/YakFlow.zip` : le paquet client.
- `construire-zip.sh` : refabrique le zip après une modification de `app-locale/`.
- `.secrets/LICENSE_SIGNING_KEY.txt` : clé privée de signature. **Ne jamais la partager ni la committer** (dossier ignoré par Git).

## Mise en ligne (une fois)

1. Netlify, Site configuration, Environment variables : ajouter
   - `LICENSE_SIGNING_KEY` = le contenu de `.secrets/LICENSE_SIGNING_KEY.txt` ;
   - `STRIPE_SECRET_KEY` = la clé secrète Stripe (`sk_live_...`), dans Stripe sous Développeurs, puis Clés API.
   Les variables d'hier (`FIREBASE_SERVICE_ACCOUNT_JSON`, `YAKFLOW_ADMIN_SECRET`) restent utilisées telles quelles.
2. Redéployer (Deploys, Trigger deploy) ou pousser sur GitHub.
3. Stripe, sur le lien de paiement : Modifier, Après le paiement, « Rediriger vers votre site web » :
   `https://yakflow.netlify.app/merci?session_id={CHECKOUT_SESSION_ID}`
4. Test : un vrai paiement (puis remboursement), récupérer le code, télécharger, lancer, activer.

## Au quotidien

- Rien à faire chaque mois : le renouvellement vérifie l'abonnement Stripe. Résiliation ou carte refusée = blocage à la fin de la période payée.
- `/admin.html` : codes d'essai 24 h, codes manuels, code « Propriétaire · illimité » pour toi, désactivation, « Réinitialiser l'ordinateur ».
- Les codes déjà créés restent valables (même base Firestore).
- Mise à jour de l'app : modifier `app-locale/`, lancer `./construire-zip.sh`, pousser.

## Limites

- Un client très motivé peut modifier le code Python pour sauter la licence. Le partage simple de code est bloqué.
- Le client doit avoir Python 3 (souvent déjà présent sur Mac, sur python.org pour Windows).
- Fichiers non signés : « clic droit, puis Ouvrir » la première fois sur Mac, « Exécuter quand même » sur Windows (expliqué dans LISEZMOI.txt).
