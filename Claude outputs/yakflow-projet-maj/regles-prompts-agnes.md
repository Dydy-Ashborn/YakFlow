# Règles de prompts Agnes — Yak Films
## Version 2 — 6 octobre 2026 (soir), après les essais Money Farm, Foot d'Actu et Dragon Pompier

Ce fichier est **la référence** pour écrire les `promptVideoAgnes` (YakFlow). En cas de conflit avec un autre fichier du projet, ce fichier gagne.

---

## 1. Principe
Agnes marche mieux quand le prompt dirige le plan comme un réalisateur : qui est où, ce qui se passe dans l'ordre, comment la caméra bouge, comment la réplique est jouée. Mais **un prompt dirigé n'est pas un prompt long** : chaque phrase doit servir le plan. Pas de bloc de verrous génériques répété partout, pas de longues listes négatives.

Cible : **60 à 140 mots** par prompt vidéo (hors réplique). Au-delà, Agnes dilue.

## 2. Ordre d'écriture (ordre officiel Agnes, adapté)
1. **Sujet et blocking** : qui est visible, gauche/droite, debout/assis, distance, objets en main.
2. **Action dans l'ordre** : la petite séquence du début à la fin. Une action principale par personnage.
3. **Caméra** : départ → mouvement → destination (« dolly-in from the two-shot to a low-angle close-up on Léo »).
4. **Style et lumière** : une demi-phrase (la lumière qui raconte : chaud famille, bleu nuit, doré riche, gris perte).
5. **Son** : ambiance + bruits d'action utiles (bips de caisse, sirène, pluie).
6. **Voix** : qui parle, langue, jeu concret, débit, seconde de fin (voir §4).
7. **Continuité** : seulement les contraintes à risque pour CE plan (interlocuteur hors champ, objet dur, personne d'autre ne parle).

## 3. Image de départ + image de fin (`imageFin`) — la méthode qui marche le mieux
Constat du 6 oct. : un clip Agnes entre **une première image et une dernière image** donne un résultat beaucoup plus propre (identité, décor, mouvement maîtrisé). On l'utilise dès que le plan bouge vraiment.

Trois cas par scène :
| Cas | Quand | Ce qu'on fait |
|---|---|---|
| **Fin dédiée** | mouvement de caméra marqué, changement d'expression, compteur qui change, objet qui apparaît | générer une image `fin-scene-N` cadrée **à la destination du mouvement** (ex. gros plan après un dolly-in), avec la scène N jointe en première image |
| **Plan continu** | la scène suivante est la suite directe du même plan | `imageFin` = l'image de la scène suivante (pas d'image en plus) |
| **Image de départ seule** | réplique simple, plan presque fixe | pas d'`imageFin` |

Règles :
- Le prompt de la fin dédiée dit : « This is the LAST FRAME of [mouvement] on the attached first image. Same place, same moment a second later, camera now [destination]. » Mêmes tenues, même lumière, mêmes objets.
- Le prompt vidéo contient « End exactly on the provided last frame. »
- **Compteurs, chiffres, écrans** : mettre l'ancienne valeur dans la première image et la nouvelle dans l'image de fin ; Agnes anime la transition proprement.
- Budget : environ 8 à 10 fins dédiées par épisode (images 2K, ChatGPT ≈ 80 images/jour : large).

## 4. Voix et débit (le défaut n°1 : « ça parle trop lentement »)
- Agnes parle à environ **3 mots par seconde** si on le lui impose. Un clip trop long la pousse à étirer la phrase.
- Durée du clip : `secondes = max(4, min(12, ceil(0,8 + mots ÷ 3) + 1))` ; la réplique doit finir **une seconde avant** la fin du clip.
- Toujours écrire : « speaks at a brisk, natural conversational French pace (about three words per second), with no long pauses, and finishes the line by second N. »
- Jouer l'émotion par la voix (volume, attaque, souffle, mot appuyé), jamais par la lenteur. Bannir : slowly, calmly, whisper, trembling, hesitant, murmur.
- `garder` = de 0 à (fin de réplique + 0,5 s).
- Une seule voix par clip. Celui qui écoute : « keeps his mouth closed ».
- **Narrateur hors champ** (actu, conte) : « Off-screen French narrator voice only; every character on screen keeps their mouth closed. »

## 5. Prononciation
Agnes lit le français à l'anglaise sur certains noms. Dans la réplique, **écrire comme ça se prononce**, pas comme ça s'écrit :
- Olise → « Olisé » ; actu → « actu » (jamais « actus » : elle prononce le S) ; ajouter un accent ou une syllabe phonétique si un nom sort mal.
- Nombres en lettres. Sigles épelés comme on les dit (« P S G », « l'O M »).
- Pas de « ! », pas de « : » ni « ; » dans la réplique. 20 mots maximum.
- Noter chaque nom corrigé dans la section « Lexique phonétique » en bas de ce fichier.

## 6. Caméra : varier selon le temps du récit
Fini le « slow push-in » partout. Chaque plan choisit le mouvement qui sert son moment :
| Moment | Mouvement |
|---|---|
| Hook (0–2 s) | dolly-in rapide ou plan fixe serré sur l'anomalie |
| Humiliation / domination | contre-plongée sur le dominant, plongée sur la victime |
| Découverte / révélation | push-in lent vers le visage puis l'objet, ou rack focus |
| Tension, fuite | caméra épaule, travelling latéral qui suit |
| Émerveillement / pouvoir | orbit lent ou crane-up |
| Solitude / fin triste | pull-out en hauteur, plan large |
| Réplique-choc | plan fixe serré, aucun mouvement |
| Insert muet (mains, écran, objet) | macro fixe ou léger glissé |

Une seule idée de mouvement par clip. Respecter l'axe des 180° et la géographie fixée.

## 7. Blocking, regards, jeu
- Fixer une carte spatiale par séquence (qui à gauche/droite, porte, table, fenêtre).
- Regards : direction précise, hauteur assis/debout.
- Le personnage silencieux réagit (oreilles, sourcils, recul) sans parler ni lip-sync.
- Gestuelle humaine : jamais à quatre pattes, pas d'aboiement, pas de halètement.
- Objets durs (or, métal, verre, bois, pierre, diamant) : rigides et intacts.
- Avec `imageDe` (même image, autre voix) : garder une pose qui tient toute la conversation ; le grand geste est réservé au dernier clip.

## 8. Texte à l'écran
- Ne pas demander de nouveau texte dans le clip : « Do not add new text or subtitles. »
- Le texte utile (étiquette de prix, compteur, panneau) est **dans l'image** (première et/ou dernière), pas inventé par la vidéo.

## 9. Fiches
Identité stable, tenue propre et neutre. États temporaires (pluie, boue, fatigue) dans la scène, jamais dans la fiche. Nouvelle tenue = nouvel id de fiche. Saison réelle.

## 10. Gabarit d'un prompt Agnes
```
[Blocking + action dans l'ordre]. Camera: [départ] → [mouvement] → [destination]. End exactly on the provided last frame.
[Lumière en demi-phrase], [sons d'ambiance utiles].
Only [X] speaks, in French, [jeu concret]: "[réplique phonétique]". He speaks at a brisk, natural conversational French pace (about three words per second), with no long pauses, and finishes the line by second [N]. [Y] keeps his mouth closed.
[1–2 contraintes de continuité propres à ce plan].
```

## Lexique phonétique (à compléter)
| Écrit | À écrire dans la réplique |
|---|---|
| Olise | Olisé |
| actus / l'actu | actu |
