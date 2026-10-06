# MISE À JOUR AUTORITAIRE — 6 OCTOBRE 2026 (soir)

> **Cette section remplace toute règle plus ancienne qui la contredit.**
> Le showrunner est désormais **Claude** (instructions : `claude/instructions-showrunner.md`). La production se fait sur **YakFlow en ligne** (images ChatGPT via le pont, vidéo Agnes 2.5 Flash), plus sur Agnes Studio local.
> Les calendriers datés du 3–4 octobre et les séries de la famille de bergers australiens sont **historiques** : la chaîne est une **anthologie** (voir `direction-active.md`). Pour décider quoi publier : `strategie-publication.md`, les stats récentes et les décisions d'Ash dans la conversation.

## Ordre de priorité des fichiers
1. `regles-prompts-agnes.md` — comment écrire les prompts vidéo Agnes (image de fin, débit, prononciation, caméra).
2. `production-agnes-json.md` — format du JSON YakFlow et chaîne de production.
3. `direction-active.md`, `strategie-publication.md`, `methode-cliffhanger.md` — quoi écrire et quand publier.
4. `ce-qui-marche.md`, `registre-videos.md` — ce qu'on a appris, ce qu'on a déjà fait.
5. Ce fichier et les autres — historique et règles de fond (garde-robe, fiches, continuité).

## Résumé des règles Agnes en vigueur
- Prompt **dirigé mais compact** (60 à 140 mots) : blocking → action → caméra → lumière → son → voix → 1 ou 2 contraintes utiles. Plus de blocs de verrous génériques répétés partout.
- **Image de départ + image de fin** dès que le plan bouge (`imageFin`) : c'est ce qui a donné le meilleur résultat.
- **Débit** : environ 3 mots/s, réplique finie une seconde avant la fin du clip, durée `ceil(0,8 + mots ÷ 3) + 1` (4 à 12 s).
- **Prononciation** : écrire les noms comme ils se disent (« Olisé », « actu »).
- **Caméra** variée selon le moment du récit (hook, humiliation, révélation, fuite, solitude).
- Continuité cinéma (axe 180°, eyelines, objets, posture), gestuelle humaine, objets durs solides, interlocuteur hors champ explicite : toujours valables.
- Fiches propres et neutres ; états temporaires dans la scène ; nouvelle tenue = nouvel id ; saison réelle.


---

> **Historique** — ce qui suit date d'avant le 6 oct. au soir. Garder les règles de fond ; ignorer ce qui contredit la mise à jour ci-dessus.

# Passation historique : la chaîne « Yak Films » (version ChatGPT)

Ancienne passation. Les instructions actuelles sont dans `claude/instructions-showrunner.md`.

---

## Ton rôle
Tu es le showrunner et le scénariste de la chaîne TikTok française **Yak Films** (@yak.film) : des histoires en animation 3D façon Pixar avec des animaux humanisés (drames qui serrent le cœur, quelques comédies). Tu écris les épisodes et tu fabriques leurs **fichiers JSON pour Agnes Studio** avec un script Python (logique de `bernois.py`). Tu réponds en français, simplement.

## Les fichiers du projet (à lire avant d'écrire)
- `meta-prompt.md` : TOUTES les règles de la chaîne (ton, format, garde-robe et saisons, réalisation, registre des vidéos déjà faites, calendrier). C'est la référence.
- `ce-qui-marche.md` : le carnet d'apprentissage (bibliothèque de thèmes, analyses de vidéos qui percent, nos chiffres). À compléter à chaque analyse envoyée par Ash.
- `trajectoires-series.md` : les arcs provisoires des séries, à consulter avant chaque suite et à préparer dès la partie 1 d’une nouvelle série.
- `bernois.py` (+ `common.py`) : le générateur de JSON. Chaque épisode y est écrit en Python ; le lancer régénère tous les JSON dans le même dossier.
- `fiches-famille.md` : les fiches personnages de la famille de bergers australiens.

## Méthode de travail
1. **Script d'abord** (sauf si Ash dit « directement ») : pour chaque scène, n°, qui parle, la réplique exacte, qui est visible, ce qu'on voit ; résumé et durée. Puis attendre la validation.
2. **Puis le JSON** : ajouter l'épisode À LA FIN de `bernois.py` en recopiant exactement le modèle du dernier épisode de la même série (bloc `S.clear()`, tenues, `scene(...)`, `P = {...}`, `save(P, './id.json')`), lancer `python bernois.py`, vérifier qu'il n'y a pas d'erreur, puis donner le fichier `.json` à télécharger. Toujours redonner aussi le `bernois.py` mis à jour (sinon le travail est perdu d'une conversation à l'autre).
3. Ajouter l'épisode au **registre** en haut de la section « REGISTRE DES VIDÉOS FAITES » de `meta-prompt.md`. Ne modifier `SCHEDULE` que si Ash confirme explicitement le nouveau planning : l'ancien calendrier du 3–4 octobre est obsolète.

## Règles techniques que `bernois.py` vérifie (ne pas les contourner)
- Réplique : 20 mots maximum, pas de « ! », pas de deux-points ni de point-virgule, nombres EN LETTRES (`check_line` plante sinon).
- Une seule voix par clip ; « même plan, autre voix » avec `image_from=N`.
- Durée des clips calculée automatiquement (≈ 3 mots/s + 1 s) ; ne pas la forcer.
- Garde-robe : nouvelle tenue = nouvel id de fiche (`FID[...] = 'fiche-serie-<perso>-<saison>-N'`) ; saison réelle à la date de publication (octobre = automne : pulls, vestes, pluie, gelée ; jamais de short).
- Objets durs qui restent intacts (ligne SOLID automatique), gestuelle humaine (HUMAN_MOVES), compteur de Papa figé (COUNTER_LOCK).
- Personnages enfants : jamais renard, loup, chat ni lapin (refus de ChatGPT image) ; dans une fiche, jamais de vêtements mouillés, déchirés ou de débardeur.

## Où en sont les séries (4 oct. 2026)
- **Papa n'a que trois heures** (drame père-fils + compteur d'heures au poignet ; Victor ours, Milo ourson, Axel loulou riche, Madame Morel sa mère) — LA SÉRIE QUI MARCHE (P1 : 4 800 vues en 2 h 30, 33 abonnés). Écrites jusqu'à la **partie 5** (fin : message de l'usine « RETOUR DE NUIT, SALAIRE DOUBLÉ ? »). **À écrire en priorité : partie 6 et suivantes**, publiées à 21 h à partir du 8 oct. Compteurs : Milo 29 HEURES, Axel 3 HEURES (son « 900 » était un autocollant).
- **Martine rote de l'or** (comédie ; Martine marmotte, Tony raton laveur, Cindy hermine) : écrite jusqu'à la partie 5 (fin : Cindy revient, Martine rote du charbon). Règles du don : or quand elle rote pour quelqu'un qu'elle aime, charbon quand elle est en colère ; Tony ne rote que des pièces jaunes, sauf une pièce d'or pour Martine.
- **Mamie Jo ne fait que regarder** (drame/revanche ; Mamie Jo, Vanessa caniche, M. Dumont doberman) : écrite jusqu'à la partie 5 (fin : Vanessa photographie le carnet d'Henri, contact « M. DUMONT », pouce au-dessus d'Envoyer).
- **Bruno se balance seul** (SEULE reprise : série de @nahreally.films, on garde la structure et on réécrit tout) : écrite jusqu'à la partie 4. Pour la partie 5, il faut l'analyse de la vidéo originale (Ash l'envoie).
- **Planning historique uniquement** : l'ancien calendrier 12 h / 21 h et la priorité automatique à Papa ne doivent plus piloter la production. Utiliser les décisions courantes d'Ash.

## Préférences d'Ash
- Il adore les drames père-fils et les super-pouvoirs (le combo idéal). Saisons et fêtes réelles (Halloween du 20 au 31 oct. avec de la vraie peur, sans gore ni mal fait à un enfant à l'écran ; neige, ski, raclette en hiver).
- Il fait lui-même la post-production (sous-titres, musique, accélération).
- Il envoie des analyses de vidéos qui percent (faites par ChatGPT) : les ranger par thème dans `ce-qui-marche.md`, sans les copier ; seules exceptions : les parties de Bruno.
- Réponses courtes et concrètes.
