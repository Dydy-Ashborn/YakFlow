# PRODUCTION — YAKFLOW / JSON (Agnes)

Ces règles sont techniques et restent actives. Mise à jour du 6 oct. 2026 (soir) : on produit avec **YakFlow en ligne** (plus Agnes Studio local / `serveur.py`). Règles d'écriture des prompts vidéo : voir `regles-prompts-agnes.md` (prioritaire).

## Chaîne de production actuelle
- **Images** : ChatGPT via le pont Tampermonkey « Pont ChatGPT » v2.1+ (code d'accès YakFlow demandé au premier lancement). Environ 80 images/jour.
- **Vidéo** : Agnes Video 2.5 Flash via YakFlow (720P, 4 à 12 s, son et voix inclus). Environ 2 épisodes/jour.
- **Moteur** : réglage « GPT + Agnes vidéo » dans YakFlow (les clips Grok ne sont plus comptés dans ce mode).
- **Images Agnes** en 2K (5/min en gratuit, aucune perte en 720P).
- Post-production par Ash : sous-titres, musique, accélération éventuelle.

## Format du JSON YakFlow
Racine : `id`, `titre`, `typePublication` (REPRISE / ORIGINALE / autre), `description`, `datePublication`, `heurePublication`, `accroche`, `commentaire`, `hashtags`, `reglesRealisation`, `etapes`, `version`, `recommendedVideoEngine: "agnes"`.

`etapes` = liste ordonnée de :
- **`fiche`** : personnage, décor ou **image de fin** (`fin-scene-N`). Champs : `id`, `nom`, `promptImage`, `joindre` (ids d'images de référence), `format` éventuel.
- **`couverture`** : la couverture TikTok.
- **`scene`** : `id`, `nom`, `promptImage`, `joindre`, `promptVideoAgnes` (prompt Agnes, prioritaire), `promptVideo` (copie de secours), `secondes` (4–12), `garder` (« 0-4.5 s »), `muet`, `transition` (`cut`), `imageDe` (réutiliser l'image d'une autre scène), **`imageFin`** (id de l'image de fin : une `fin-scene-N` ou la scène suivante).

Règles :
- Les fiches `fin-scene-N` sont placées **juste après** leur scène et joignent la scène N en premier (« Use the first attached image as the starting shot to continue »).
- Une scène avec `imageFin` attend que les deux images soient prêtes avant de partir en vidéo.
- Ids stables : ne pas renommer un id entre deux versions, sinon le travail déjà fait n'est pas repris au réimport.
- Réimport : seules les étapes dont le prompt n'a pas changé gardent leurs images/clips (sauf case « Garder mes images et mes clips »). Pour refaire seulement certaines scènes, changer uniquement leurs prompts.

## Workflow
Ne jamais générer directement le JSON à partir d'une idée.

Ordre :
1. concept ;
2. scénario ;
3. dialogues ;
4. découpage scène par scène ;
5. composition visuelle ;
6. validation « ce qui marche » ;
7. validation anti-doublon ;
8. JSON.

## Dialogue
- une seule voix par clip ;
- idéalement répliques très courtes ;
- maximum 20 mots par dialogue ;
- pas de `!` ;
- pas de `:` ou `;` dans le dialogue parlé ;
- nombres écrits en toutes lettres dans les dialogues ;
- français naturel ;
- pas de débit artificiellement lent.

## Durées
`secondes = max(4, min(12, ceil(0,8 + mots ÷ 3) + 1))`, réplique terminée une seconde avant la fin (« finishes the line by second N »).
Éviter les clips inutilement longs : Agnes étire la voix pour remplir.
Plans muets : 4 à 5 s selon l'action.

## Plans
- 9:16 vertical natif (720×1280 côté Agnes) ;
- composition full-bleed verticale ;
- visages lisibles sur téléphone ;
- une action principale par clip ;
- chaque plan doit apporter quelque chose ;
- plans de réaction utiles ;
- hard cuts quand le lieu ou l'information change ;
- pas de zoom brutal ;
- mouvement de caméra choisi selon le moment du récit (tableau dans `regles-prompts-agnes.md`), pas de « slow push-in » systématique.

## Même plan, autre personnage qui parle
Utiliser `image_from` quand on reste sur la même image et qu'un autre personnage prend la parole.


## Fiches personnages — règle des 3 visuels

Pour chaque personnage principal, la fiche de référence doit contenir **3 visuels cohérents du même personnage** :

1. **plein pied face caméra**
2. **plein pied en trois-quarts**
3. **gros plan du visage avec les épaules visibles**

Le troisième visuel sert à verrouiller précisément :
- forme du museau ;
- yeux ;
- sourcils ;
- oreilles ;
- implantation et couleurs du pelage ;
- proportions du visage ;
- détails distinctifs ;
- expression neutre lisible.

Les 3 visuels doivent conserver exactement :
- la même identité ;
- la même race / espèce ;
- les mêmes couleurs ;
- les mêmes traits faciaux ;
- les mêmes proportions ;
- la même tenue de référence.

**Ne pas utiliser un profil comme troisième visuel par défaut.**

Pour un personnage secondaire très bref, une seule référence peut suffire si nécessaire, mais les personnages principaux doivent privilégier ce format 3 visuels.


## Références personnages
Les références de personnages sont obligatoires quand elles existent.
Si une référence requise manque, Agnes doit bloquer la génération plutôt que créer un personnage différent.

Un animal anthropomorphe ne doit jamais devenir humain.

## Médias dans l'image
Tout personnage visible dans :
- photo ;
- cadre ;
- affiche ;
- dessin ;
- téléphone ;
- tablette ;
- ordinateur ;
- document imprimé

reste totalement figé et muet, sauf si le scénario demande explicitement que cette image prenne vie.

Pas de clignement, lèvres, mouvement ou voix provenant d'une photo/écran par défaut.

## Continuité
Ne pas joindre comme référence une scène précédente contenant un mauvais personnage juste pour conserver le décor.

Pour un décor récurrent, préférer une fiche décor vide.

## Gestuelle
Les personnages anthropomorphes se comportent comme des acteurs humains :
- debout ;
- gestes humains ;
- mains humanisées couvertes de fourrure ;
- pas de comportement animal involontaire ;
- pas de quatre pattes ;
- pas d'aboiement ou halètement sauf scénario explicite.

## Vêtements
Tenues cohérentes avec :
- saison réelle ;
- météo ;
- heure ;
- contexte.

Les vêtements peuvent changer entre des histoires indépendantes.

## Style visuel
Animation 3D cinématographique haut de gamme, expressive et non photoréaliste.
Personnages animaux anthropomorphes avec anatomie humaine stylisée et mains couvertes de fourrure.
Aucun humain accidentel.

## Génération du JSON
- Avec Claude : le JSON est généré par un petit script Python (même logique que `bernois.py` / `common.py` : contrôle des répliques, durées, garde-robe, lignes SOLID/HUMAN_MOVES ciblées), puis vérifié (JSON valide, ids uniques, chaque `imageFin` et `imageDe` pointe vers un id existant, durée totale).
- `bernois.py` reste l'historique des anciennes séries ; l'utiliser quand on continue une de ces séries.
- Toujours livrer le fichier `.json` téléchargeable, nommé `<id>-vN.json`.
