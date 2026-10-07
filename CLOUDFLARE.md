# YakFlow · mettre en ligne le relais Cloudflare (une seule fois, 10 minutes)

Le relais fait passer les appels Agnes des abonnés. Il vérifie la licence signée de chaque appel, sans base de données.

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up
2. Menu **Compute (Workers)** (ou **Workers & Pages**) > **Créer** > **Créer un Worker** (modèle « Hello World »).
3. Nomme-le **yakflow-relais**, puis **Déployer**.
4. Clique sur **Modifier le code**, efface tout, colle le contenu de `cloudflare/worker.js`, puis **Déployer**.
5. Note l'adresse affichée, du type `https://yakflow-relais.TON-NOM.workers.dev`.
   Vérifie-la : `https://yakflow-relais.TON-NOM.workers.dev/ping` doit afficher `{"ok":true,"mode":"relais"}`.
6. Dans `public/yakflow-config.js`, mets cette adresse dans `workerUrl`, puis pousse sur GitHub.

Forfait : le gratuit (100 000 requêtes par jour) tient environ 15 clients qui fabriquent le même jour en mode Agnes.
Au-delà, le forfait Workers Paid (5 $ par mois) en tient plusieurs centaines.
