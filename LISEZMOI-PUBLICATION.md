# YakFlow · dossier de publication

Ce dossier est une copie de travail séparée de `/Users/didi/Downloads/yakflow`. Il vise un site Netlify avec des codes stockés dans Firestore (`yakflow-e4d30`). **Il n’a pas encore été déployé ni validé avec une vraie génération vidéo.**

## Parcours d’accès

1. Le visiteur choisit **essai 24 h** ou **accès complet** et remplit le formulaire Netlify.
2. Netlify enregistre la demande. Une notification email doit être activée dans **Forms → Submission notifications** pour recevoir chaque demande.
3. Pour l’accès complet, le site montre ensuite [le lien Stripe transmis](https://buy.stripe.com/cNidR90oq4aXfym3xF8so0a). Vérifier dans Stripe qu’il correspond bien à l’abonnement récurrent de 2,99 €/mois avant le lancement.
4. L’administrateur vérifie le paiement Stripe, ouvre `/admin.html`, génère le code, copie l’email du client et prépare sa réponse. L’essai expire 24 h après la création du code. Le code premium reste actif jusqu’à sa désactivation.
5. Lors d’une résiliation, l’administrateur désactive le code sur `/admin.html` (par code ou par email). La fonction de validation refuse ensuite le code dans Firebase.

## Configuration nécessaire dans Netlify

- Publier **la racine de ce dossier** comme projet Netlify. `netlify.toml` désigne `public/` pour le site et `netlify/functions/` pour les fonctions. Un simple glisser-déposer du dossier `public/` ne déploierait pas les fonctions.
- Activer la détection de formulaires Netlify et ajouter une notification email pour `yakflow-access`.
- Définir `FIREBASE_SERVICE_ACCOUNT_JSON` dans les variables d’environnement du site, avec le JSON d’un compte de service autorisé à lire et écrire Firestore sur `yakflow-e4d30`. Ce secret doit rester **uniquement** dans Netlify, jamais dans `public/`, dans Git ou dans un message public.
- Définir `YAKFLOW_ADMIN_SECRET` dans les variables d’environnement du site : au moins 32 caractères aléatoires. La page `/admin.html` le demande à chaque session et ne l’enregistre pas dans le navigateur.
- Après ajout ou modification de ces variables, redéployer le site.

## Essais avant d’ouvrir au public

- Envoyer une demande d’essai depuis le site et constater sa réception dans Forms et par email.
- Générer un essai depuis `/admin.html`, l’activer sur le site, puis vérifier son expiration et sa désactivation.
- Vérifier le paiement Stripe avant de générer un code premium ; résilier un abonnement test et désactiver le code par email.
- Tester sur le site chacun des quatre modes avec les comptes et clés des fournisseurs : Agnes → Agnes, GPT → Agnes, Agnes → Grok, GPT → Grok. Les ponts installés depuis le site demandent son adresse HTTPS et le code YakFlow lors de leur première ouverture.
- Tester un montage et le téléchargement final dans Chrome/Edge, puis sur le mobile prévu.

## Limites connues à vérifier en vrai

- Les fonctions Netlify ont une limite de 60 s et de 6 Mo par requête/réponse tamponnée ; les gros fichiers peuvent nécessiter d’autres adaptations. Les vidéos Grok sont transférées en fragments de 3 Mo. Les références image envoyées au cloud sont réduites à 1024 px et les images ChatGPT renvoyées à 2048 px.
- Les clips et images en transit sont conservés dans Netlify Blobs le temps du travail. Les résultats terminés sont supprimés après réception quand le parcours normal se termine ; les travaux interrompus demandent encore une stratégie de nettoyage automatique.
- Le paiement, l’envoi des codes et la désactivation après résiliation restent manuels, conformément au parcours demandé.
- Le lien de gestion/résiliation Stripe n’a pas été fourni ; le bouton correspondant est masqué jusqu’à sa configuration.
- La page est publique au sens technique : son code navigateur reste visible. La validation du code protège les fonctions de production, pas la lecture du HTML.

## Fichiers principaux

- `public/index.html` : YakFlow web et formulaire Netlify.
- `public/admin.html` : génération et désactivation des codes.
- `public/pont-chatgpt.user.js` et `public/pont-grok.user.js` : ponts cloud pour ordinateur, sans serveur local.
- `netlify/functions/` : validation, administration, relais Agnes et files ChatGPT/Grok.
- `tests/` : tests locaux du format et de la durée des codes.

Documentation officielle : [Netlify Forms](https://docs.netlify.com/manage/forms/setup/), [notifications Forms](https://docs.netlify.com/manage/forms/notifications/), [fonctions Netlify](https://docs.netlify.com/build/functions/get-started/), [limites des fonctions](https://docs.netlify.com/build/functions/configuration/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup).
