# MISE À JOUR TECHNIQUE — 6 OCTOBRE 2026 (soir)

## Ce qu'on a appris sur la fabrication (Agnes + YakFlow)
- **Image de départ + image de fin = le meilleur résultat obtenu.** Essai Money Farm : les clips cadrés entre deux images (`imageFin`) sont « super propres » (retour d'Ash). Identité, décor et mouvement de caméra tenus. On le généralise aux plans qui bougent ; les répliques simples restent en image de départ seule. Détail : `regles-prompts-agnes.md` §3.
- **Les compteurs et chiffres s'animent bien** quand l'ancienne valeur est dans la première image et la nouvelle dans la dernière.
- **Voix trop lente** (Money Farm) : corrigé en calant la durée sur les mots (≈ 3 mots/s) et en imposant « finishes the line by second N ». Un clip trop long = voix étirée.
- **Prononciation** (Foot d'Actu) : Agnes dit « Olise » au lieu de « Olisé » et « actuS ». On écrit les noms phonétiquement dans la réplique ; lexique tenu dans `regles-prompts-agnes.md`.
- **Épisodes statiques** : les plans tous en « slow push-in » donnent un épisode plat. On varie la caméra selon le moment du récit et on donne une vraie action à chaque plan.
- **Prompt dirigé mais compact** : la direction détaillée (blocking, regards, jeu, voix) marche ; les gros blocs de verrous répétés et les longues listes négatives n'aident pas. 60 à 140 mots par plan.
- **Narrateur hors champ** (formats actu, conte) : préciser que tous les personnages à l'écran gardent la bouche fermée.
- **Budget réel** : environ 2 épisodes vidéo/jour et 80 images GPT/jour. Les images de fin (8 à 10 par épisode) tiennent largement dans ce budget.
- Les règles plus anciennes restent vraies : continuité spatiale, hors champ explicite, `imageDe` avec pose tenue, objet dur solide, état temporaire dans la scène et pas dans la fiche.

## Titres
- « Niveau Argent » renommé **« Money Farm »** : un titre court, concret, qui sonne comme une promesse (et qui marche en FR comme en anglais) vaut mieux qu'une traduction descriptive.

## Planning
Les anciens calendriers datés du 3–4 octobre sont **historiques**. Voir `strategie-publication.md` et les décisions d'Ash.

## Épisodes à suivre (stats à remplir J+1 et J+2)
| Épisode | Format | Publié le | Vues | Temps moyen | % en entier | Partages | Abonnés | Leçon |
|---|---|---|---|---|---|---|---|---|
| Money Farm | ORIGINALE, monde à règle visible (argent au-dessus de la tête), keyframes | | | | | | | |
| Foot d'Actu — 6 oct. | actu foot animée, narrateur | | | | | | | |
| Le Dragon Pompier | court métrage, petit héros / grand courage | | | | | | | |


# Ce qui marche — carnet d'apprentissage de la chaîne Yak Films

But : apprendre, vidéo après vidéo, pourquoi les vidéos américaines percent (leur histoire autant que leur technique), pour pouvoir ensuite créer nos propres histoires originales avec les mêmes ressorts.

Méthode (décidée le 3 oct. 2026) : on range ce qu'on apprend PAR THÈME. Chaque analyse alimente un thème ; une histoire à nous (ex. « Martine rote de l'or ») est construite à partir d'un thème et de ses ressorts, jamais copiée sur une vidéo. Seule reprise : « Bruno se balance seul ».

## Apprendre à écrire les suites
Les parties de « Dog swings alone » étudiées chez @nahreally.films constituent un laboratoire de **construction de série**. Pour Bruno, on suit leur progression structurale en réécrivant le contenu. Pour toutes les autres séries, on retient les ressorts narratifs transférables sans répéter leur intrigue : une ouverture autonome, une promesse qui change de sens, un objet qui revient chargé d'une émotion nouvelle, un secret que le public connaît avant le héros, une victoire qui a un coût et une fin qui ouvre une conséquence concrète. Choisir à chaque épisode le ressort adapté à son arc, pas une recette fixe. Préparer dès l'épisode 1 la trajectoire provisoire jusqu'à la résolution, puis vérifier à chaque suite ce qu'elle fait réellement avancer.

## Comment on remplit ce carnet
- À chaque analyse envoyée par Ash : une fiche dans « Vidéos étudiées », avec le scénario décortiqué.
- Le lendemain de la publication de notre version : Ash donne les stats (vues, % regardé jusqu'au bout, partages, commentaires, abonnés gagnés), on les note dans la fiche et on compare avec l'original.
- Toutes les 5 fiches : on met à jour « Les règles qui marchent » (ce qui revient dans les vidéos qui percent, ce qui a marché ou raté chez nous).
- Les histoires originales (mode A) sont ouvertes : on les construit à partir de la « Bibliothèque de thèmes » ci-dessous.

## Bibliothèque de thèmes (à compléter à chaque analyse)
Priorité d'Ash : les drames de relation père-fils sont ses histoires préférées (c'est ce qui lui parle le plus). Quand on hésite entre deux idées, on penche vers le père et le fils. Ash adore aussi les super-pouvoirs : à intégrer (le combo idéal = drame père-fils + don/pouvoir).
Pour chaque thème : le ressort, la structure qui marche, ce qu'on a vu, ce qu'on en a fait, ce qui reste à essayer.

### Le don exploité
- Ressort : un don enrichit les proches, ils deviennent avides, exploitent puis abandonnent ; la victime reprend l'avantage à la fin.
- Vu : fiches 3 (@fruitystories36) et 4 (@toons7078).
- Chez nous : « Martine rote de l'or » (marmotte, raton laveur), histoire originale.
- À essayer : le don qui se vide (la victime s'épuise), le proche qui comprend trop tard.

### L'argent et devenir riche
- Ressort : la richesse promise change ceux qui l'approchent ; l'argent révèle qui aime vraiment.
- Vu : fiches 3 et 4 (richesse tirée d'un don) ; thème signalé par Ash comme porteur en ce moment.
- À essayer : l'héritage, le trésor trouvé, le gain soudain et ses conséquences sur la famille.

### La trahison pour de l'argent
- Ressort : un proche (conjointe, associé, ami) trahit pour l'argent ; indignation du public, envie de juger.
- Vu : thème signalé par Ash ; fiche 8 (@fruitwist.tv : la femme lâche son mari dans le vide pour un diamant, il tombe dans une mine de diamants).
- Structure qui marche (fiche 8) : choix cruel dès la 1re image (suspendu au-dessus du vide, « donne-moi ce diamant et je te remonte ») → trahison → récompense DISPROPORTIONNÉE pour la victime (une pierre contre une mine) → les traîtres profitent → la victime devient le patron en secret → le traître entre chez lui sans le savoir (ironie dramatique : « j'ai les moyens maintenant ») → coupure juste avant la confrontation (« c'est moi qui vais te dire le prix ») + « Partie 2 ?? ».
- Émotion visée : indignation puis satisfaction de la revanche (pas les larmes). Un objet relie toutes les scènes (le diamant).
- À essayer : drame de famille en animaux humanisés ; version père-fils possible (le père trahi revient riche, et son fils est du côté des traîtres sans savoir).

### La revanche du sous-estimé
- Ressort transversal (fiches 4, 5, 7, 8) : la victime méprisée reprend le pouvoir, mais on coupe JUSTE AVANT la revanche. La promesse de revanche fait réclamer la suite mieux que la revanche montrée.

### Le parent qui se sacrifie / le temps avec ses proches
- Ressort : un parent modeste donne tout, un rival le méprise ; ou le temps limité passé avec un père (compteur, timer).
- Vu : fiches 1, 2, 5, 9 (@nahreally.films) et 3 (@fruitystories36).
- Chez nous : « Bruno se balance seul » (reprise), « Papa n'a que trois heures » (originale, ours).
- À essayer : le compteur sur le bras (préféré par Ash au timer).

### L'appel déguisé (demander de l'aide sans que le danger le sache)
- Ressort : la victime parle en code (« je voudrais commander une pizza ») ; chaque question des secours peut la sauver ou la trahir ; le danger surveille de plus en plus près. Le public voit la menace avant la victime.
- Structure vue : mensonge rassurant → piège qui se referme → initiative discrète → surveillance qui se renforce → appel découvert → l'aide arrive (gyrophares), sauvetage non montré.
- Vu : fiche 6 (@fruitstvdaily, enfant enlevé en voiture).
- Chez nous : on garde le ressort, PAS la situation (pas d'enfant enlevé ni malmené). Pistes : Mamie Jo seule chez elle avec un faux plombier ou un faux policier, qui appelle à l'aide en « commandant une pizza » ; un ado qui rassure son agresseur au téléphone, etc.

### L'enfant sous-estimé et le don caché
- Ressort : on colle une étiquette au héros dès le début (« rien de spécial ») ; il est humilié sur tout ce qu'il est (famille, école, talent) ; on lui détruit l'objet qu'on l'a vu chérir (ses dessins brûlés) ; un allié remet l'étiquette en question et une lumière annonce le vrai don, sans le montrer.
- Structure vue : étiquette à la naissance → phrase tendre de la mère → talent personnel visible → humiliations croissantes → objet affectif détruit → allié inattendu → révélation hypothétique (« tes pouvoirs ont été désactivés ») = appel à la suite.
- Visuel : les « méchants » ont chacun une couleur et un effet, le héros est neutre ; sa couleur à lui (le doré) n'apparaît qu'à la fin.
- Vu : fiche 7 (@lesminicontes11, canettes à pouvoirs).
- Chez nous : version père-fils possible (le seul qui croit au fils « sans don », c'est le père ; ou c'est le père qui découvre pourquoi le don a été caché). On ne reprend PAS les insultes : le contraste conte mignon / langage vulgaire fait réagir mais n'est pas notre ton et expose un compte neuf.

### Événements (Halloween, neige, Noël…)
- Règle : on publie pendant la période, avec la météo et la saison réelles. Halloween 2026 : épisodes du 20 au 31 oct., vraie peur voulue par Ash, sans gore (voir `meta-prompt.md`, « Saisons et événements »).
- Vu : aucune analyse encore. Ash en enverra ; ranger ici ce qui perce (porte-à-porte, déguisements, maison hantée…).
- Boîte à outils de la peur (idées d'Ash et vues) : le sourire figé qui ne va pas avec les yeux (type film « Smile »), un personnage qui sourit quand les autres ont peur, un sourire qui s'élargit lentement, un personnage qui ne cligne pas des yeux, quelqu'un qui reste immobile à la fenêtre, une présence derrière un personnage qui ne se retourne pas. Vu aussi fiche 6 (visage monstrueux dès la 1re image).
- Ressort de peur noté par Ash : le sourire qui ne devrait pas être là (façon film « Smile ») — un personnage qui sourit trop large, trop longtemps, au mauvais moment, sans cligner des yeux. On l'a aussi vu dans la fiche 6 (le sourire inquiétant du méchant, danger lisible dès la 1re image). Piste visuelle : sourire fixe + yeux sérieux, plan presque fixe, ambiance silencieuse.
- À essayer : mini-série Halloween père-fils (le père qui fait semblant de ne pas avoir peur) ; première neige et luge ; raclette en famille.

### Thèmes écartés
- Mises en scène d'adultes qui abordent des enfants et les enlèvent, enfant malmené à l'écran : on ne le fait pas (contenu à risque pour un compte neuf, hors de notre ton). On peut en garder les ressorts dans une autre situation (voir « L'appel déguisé »).

## Nos chiffres (suivi)
- Bruno se balance seul · Partie 1 (publiée le 2 oct. 23 h 45) : à J+1 matin, 630 vues, 48 likes, 2 commentaires, 14 partages, 8 enregistrements, 11 abonnés gagnés (30 visites de profil), temps moyen 18 s sur 95 s, 13,33 % regardée en entier. Lecture : très bons partages et conversion en abonnés, mais début à travailler et vidéo trop longue (original ≈ 60 s). Publiée à minuit, heure creuse.
- Cause probable de la rétention faible : Bruno P1 a été publiée SANS l'accélération ×1,4 (on a dit à Ash qu'elle était lente et « endormait »). Depuis, Ash accélère chaque vidéo ×1,4 avant de publier (95 s deviennent environ 68 s, proche de l'original).
- Martine rote de l'or · Partie 1 (publiée le 3 oct. 11 h 58, durée 57 s, accélérée) : après 2 h, 1 401 vues (déjà plus que Bruno P1 en 14 h), 67 likes, 5 commentaires, 0 partage, 13 enregistrements, 10 abonnés ; temps moyen 23,7 s (41 % de la vidéo), 26 % la regardent en entier ; 98,4 % des vues viennent de « Pour toi » ; la plupart décrochent à 0:02.
- Bruno P1 mise à jour (3 oct. 13 h 50) : 835 vues, 68 likes, 3 commentaires, 14 partages, 10 enregistrements, 9 abonnés ; temps moyen 20,7 s sur 95 s (22 %), 15,7 % la regardent en entier ; 91,9 % « Pour toi ». Compte : 21 abonnés, 135 likes.
- Relevé du 3 oct. 23 h 28 (compte : 55 abonnés, 364 j'aime) :
  - Papa n'a que trois heures · Partie 1 (publiée 3 oct. 20 h 59, 60 s, accélérée) : après 2 h 30, 4 793 vues, 162 likes, 1 commentaire, 0 partage, 26 enregistrements, 33 abonnés ; temps moyen 25,1 s (42 %), 27,35 % en entier ; 86 % encore là à 1 s ; 99,3 % « Pour toi ». MEILLEURE VIDÉO DE LA CHAÎNE.
  - Bruno se balance seul · Partie 2 (publiée 3 oct. 18 h 01, 62 s, accélérée) : 914 vues, 57 likes, 2 commentaires, 1 partage, 12 enregistrements, 8 abonnés ; temps moyen 15,1 s (24 %), 12,2 % en entier ; grosse chute dans les 2 premières secondes ; les vues retombent après la 1re heure.
  - Lecture (même vitesse, même durée, même soirée, donc comparable, mais une seule vidéo de chaque) : le concept de Papa (drame père-fils + pouvoir visible : le compteur au poignet) se comprend en 1 s sans contexte ; Bruno P2 est une SUITE d'une partie 1 peu vue, et son ouverture (enfant seul la nuit) ne dit pas l'enjeu. Confirme la priorité d'Ash : père-fils + don/pouvoir. À vérifier avec Papa P2.
  - Règle provisoire : quand une vidéo décolle, publier sa suite plus tôt que prévu (le lendemain), tant que l'attention est là.
- Comparaison À NE PAS INTERPRÉTER (Ash, 3 oct.) : Bruno P1 était lente (non accélérée, 95 s, publiée à minuit) et Martine est accélérée (57 s, publiée à midi) : trop de différences pour comparer. On comparera avec Bruno P2, accélérée comme Martine. Seul constat solide à ce stade : les deux perdent la plupart des spectateurs dans les 2 premières secondes ; le drame a eu des partages (14), la comédie 0 (à confirmer).
- À faire : épisodes de 60 à 75 s, accroche plus forte dès la première seconde ; publier à 12 h et 19 h ; relire les vues à J+2.

## Les règles qui marchent (provisoires : tirées de 5 fiches, à confirmer avec nos chiffres)
- Hook : « Papa » (ou « Maman ») dès le premier mot + une question sur un objectif qu'on voit à l'écran (« elle sera finie quand, notre maison ? »). Le lien et l'enjeu sont posés en 2 s.
- Histoires qui marchent : un parent modeste qui se sacrifie pour son enfant, face à quelqu'un qui le méprise pour son manque d'argent. Gentil contre méchant, sans nuance.
- Structures : promesse à quelqu'un qu'on aime → mépris de l'effort → sacrifice visible → objectif accompli → perte quand même → dernière parole tendre à double sens.
- Méchants : caricaturaux, on les déteste en 5 s ; au moins trois humiliations répétées (c'est l'indignation qui fait commenter). Pas de revanche à la fin.
- Objets : l'amour passe par des objets qu'on voit (la maison, la montre laissée au comptoir, la balançoire). Un objet préparé avec amour reste à l'image après le départ.
- Refrain : une réplique répétée (« presque fini, mon grand ») qui change de sens à chaque fois.
- Chutes : un sourire avec des larmes, puis le héros seul dans un plan large, vu de dos. Fin ouverte (« il reviendra ? ») qui appelle une partie 2.
- Durée et rythme : environ 60 s, plans de 1 à 3 s, coupes franches, inserts muets d'action (mains, objets) entre les répliques.
- Lumière : chaude pour la famille, bleue la nuit pour le travail, luxueuse chez le méchant ; la fin triste reste dans une lumière chaude.
- Personnages et duos : 4 voix possibles (enfant, héros, méchante, rival) ; l'enfant ouvre et ferme l'histoire.
- Ce qui fait commenter et partager : juger le méchant, défendre le héros, la fin ouverte, l'identification au parent qui se sacrifie.
- Titres : l'original s'appelle « Dog swings alone » (« Dog » = le prénom du héros) : prénom du héros + l'image finale la plus triste, en mots simples. Notre version : « Bruno se balance seul ». La saison 2 de l'original fait 518,9 k vues.
- Couvertures : affiche de film avec tout le casting (gentils devant, méchants derrière), le décor clé (maison, balançoire) au coucher du soleil, titre en grosses lettres dorées en haut + « PARTIE N » / « SAISON N ».
- Ironie dramatique : montrer la menace au spectateur AVANT le moment heureux du héros (fiche 2) ; une phrase d'espoir du héros devient alors insupportable.
- Récompense puis perte : donner d'abord ce que le public attend (retrouvailles), puis le reprendre (fiche 2).
- Séries : une vidéo qui perce devient une série (7 suites chez @nahreally.films) ; la fin ouverte et l'injustice non réglée sont le moteur des suites.
- (mise à jour à 5 fiches) Genre qui revient : « le don exploité » (fiches 3 et 4) — un don enrichit la famille, le proche devient avide, exploite puis abandonne ; la revanche s'annonce à la fin.
- (5 fiches) La fin la plus forte : le récit change de héros à la dernière seconde — la victime (enfant, femme abandonnée) annonce face caméra qu'elle va reprendre l'avantage (fiches 4 et 5). Une promesse de revanche vaut mieux qu'une revanche montrée : elle appelle la partie suivante.
- (5 fiches) Le héros qui participe à sa propre perte (démolir sa maison, creuser pour l'exploiteur) est plus cruel qu'une perte subie : à utiliser une fois par série.
- (5 fiches) Un objet préparé avec amour (montre, balançoire, dessin, vélo) revient d'une partie à l'autre et change de sens ; un objet de remplacement brillant (toboggan en plastique, jacuzzi) incarne le méchant.
- (5 fiches) Hooks : deux écoles — le phénomène impossible montré avant l'explication (fiches 3 et 4), ou la phrase qui pose le lien et l'enjeu (« Papa… »). Chez nous, on garde toujours une réplique dès la première seconde.
- (8 fiches) Tendance en France en ce moment (fiches 6, 7, 8) : comptes d'objets ou de fruits humanisés en 3D IA, mélodrame en français familier, environ 1 min 15, sous-titres blancs gras mot par mot, fin coupée avec « Partie 2 ?? ». Nos animaux humanisés sont dans la même famille, avec plus de soin.
- Ce qui ne marche pas chez nous :

## Réalisation apprise (fiches 1 et 2)
- Rythme : environ 2 s par plan (27 à 29 plans pour 60 s). Les répliques importantes tiennent 3 s, les déplacements et les inserts 1 à 2 s. Chez nous : 18 clips, le montage coupe chaque clip à la fin de la réplique. Les plans muets sont gardés 3 à 4 s.
- Caméra : presque fixe, avec parfois un léger rapprochement ; le mouvement vient des personnages et des gestes. Appliqué : plan fixe pour le hook et la chute, lente avancée d'environ 15 % ailleurs.
- Coupes franches, pas de transitions décoratives. Appliqué : coupe franche, fondu de 0,2 s seulement quand deux clips partent de la même image.
- Alternance plan large pour comprendre / plan rapproché pour ressentir ; gros plans d'inserts muets (mains, montre, corde, dossier).
- La lumière raconte : chaud pour la famille, nuit bleue pour l'effort ou la fuite, luxe doré chez le riche, ciel gris pour la perte.
- Un texte dans l'image rend l'enjeu lisible sans dialogue (« FORECLOSURE », « PROPERTY OF WOLF »).
- Dernier plan : large, en hauteur, deux actions dans la même image (l'un reste, l'autre part).
- Sous-titres incrustés : blancs, gras, en capitales, mot par mot, en bas de l'image. Chez nous : Ash les ajoute lui-même avant de publier (pas besoin de les faire au montage).
- Musique douce et triste sous les voix (Agnes n'en fait pas : à ajouter à la publication avec un son TikTok, volume bas).

## Vidéos étudiées

### 1. La maison et la balançoire — @nahreally.films (US) — vue le 2 oct. 2026
- Chiffres de l'original : la vidéo qui a fait percer le compte (selon Ash), suivie de 7 suites ; vues à relever sur TikTok ; durée 60 s d'histoire, 27 plans (≈ 2,2 s par plan)
- Ton : émotion et indignation, rival caricatural
- Thème : amour paternel, efforts modestes méprisés par la richesse
- SCÉNARIO
  - Situation de départ : un père construit lui-même la maison de sa famille ; la mère préfère un rival riche.
  - Personnages et rôles : le père (travailleur, humilié, ne se venge jamais), la mère (méprise, part), le loup riche (frime, se moque), l'enfant (ancrage émotionnel : question au début, promesse à la fin), un vendeur (montre le sacrifice).
  - Déclencheur : la mère compare le chantier à la vraie maison du rival et part.
  - Montée : moqueries répétées pendant que le père travaille la nuit ; il échange sa montre pour acheter la balançoire.
  - Retournement : la maison est finie, mais la mère revient pour emmener l'enfant. Réussir ne suffit pas.
  - Chute : « Je reviendrai essayer la balançoire, promis. » / « Je serai juste ici. Elles ne vont pas disparaître. » Sourire en larmes, père seul au portail.
  - Pourquoi l'histoire marche : on prend parti en 5 secondes ; l'amour est rendu visible par des objets (maison, montre, balançoire) ; la récompense est retardée puis refusée.
- Hook (0-2 s) : « Papa, quand est-ce qu'on aura fini notre maison ? » — le mot « Papa » + un objectif visible + une promesse (« presque »).
- Structure : promesse à quelqu'un qu'on aime → quelqu'un dévalorise l'effort → sacrifice visible → objectif accompli → perte malgré la réussite → dernière parole tendre à double sens.
- Pourquoi ça a percé : indignation contre les méchants (commentaires), identification au parent qui se sacrifie (partages), fin ouverte (« il reviendra ? »).
- Technique à retenir : plans très courts (1 à 3 s), coupes franches, plans muets d'action (montre sur le comptoir, corde attachée), alternance plan large pour comprendre / rapproché pour ressentir, nuit bleue pour le travail, lumière chaude pour la fin triste.
- Notre version : « La maison » — Bruno rénove seul la maison familiale sous les bâches ; Lucie part chez Marco (voisin riche, lévrier afghan) et revient chercher Gaspard le jour où tout est fini, balançoire comprise. Gardé : l'histoire entière, la montre, le refrain « presque fini », la réplique finale à double sens. Changé : rénovation à la française (bâches, bassine, avant Noël), jacuzzi fumant en octobre, toutes les répliques réécrites.
- Nos chiffres (J+1) :
- Leçon :
### 2. Retour à la balançoire (partie 2 de la série « Dog swings alone ») — @nahreally.films (US) — vue le 2 oct. 2026
- Chiffres de l'original : non visibles ; durée 60 s d'histoire, 29 plans (≈ 2,1 s par plan)
- Ton : émotion et indignation
- Thème : retrouvailles père-fils puis perte du foyer (abus de pouvoir du riche)
- SCÉNARIO
  - Situation de départ : l'enfant s'enfuit la nuit pour rejoindre son père, comme promis.
  - Personnages et rôles : le père (bonheur puis injustice), l'enfant (espoir puis douleur), la mère (découvre la fuite, humilie), le riche (rachète le prêt, prend la maison), une intermédiaire administrative (renarde en tailleur : rend la menace « officielle »).
  - Déclencheur : la mère trouve le lit vide ; le riche comprend et téléphone pour « tout » prendre.
  - Montée : IRONIE DRAMATIQUE — on montre l'appel AVANT le petit-déjeuner heureux ; le père dit « j'espère que ce moment durera toujours » alors que le spectateur sait.
  - Retournement : 7 jours pour partir ; « c'est mon terrain maintenant » ; la mère : « encore plus raté que je pensais ».
  - Chute : « Papa, qu'est-ce qui se passe ? », puis plus un mot : le père part avec un sac, l'enfant retourne seul sur la balançoire ; dernier plan en hauteur qui montre la distance entre eux.
  - Pourquoi l'histoire marche : la récompense d'abord (retrouvailles, balançoire), puis on la reprend ; le spectateur en sait plus que le héros ; l'objet de la partie 1 (balançoire) revient et change de sens.
- Hook (0-3 s) : « Je te l'avais promis, papa. Je t'avais promis de revenir. » — une promesse déjà faite, un enfant avec un sac la nuit.
- Pourquoi ça a percé : retrouvailles qui font pleurer, injustice encore plus grande que la partie 1, fin qui appelle la partie 3.
- Technique à retenir : nuit bleue + intérieur chaud pour les retrouvailles, soleil pour le bonheur, ciel gris pour le départ ; un panneau écrit (« PROPERTY OF WOLF ») rend la perte lisible sans dialogue ; la fin sans paroles, deux actions dans la même image.
- Notre version : « Partie 2 » — Gaspard s'enfuit du chalet de Marco ; Marco appelle une huissière (renarde) ; 7 jours pour partir. Gardé : structure, ironie dramatique, balançoire, panneau. Changé : vocabulaire français (huissière, « racheté votre prêt »), répliques réécrites, « jolie balançoire » au lieu de la clôture.
- Nos chiffres (J+1) :
- Leçon :

### 3. Le don qui enrichit la famille (« timer » de temps) — @fruitystories36 (US) — vue le 2 oct. 2026
- Chiffres de l'original : non visibles dans le fichier (impossible de confirmer qu'elle a percé) ; durée 1 min 51 d'histoire, 21 plans (≈ 5 s par plan, plus lent que @nahreally.films)
- Ton : émotion et indignation
- Thème : l'argent qui corrompt un parent aimant, l'exploitation d'un enfant
- SCÉNARIO
  - Situation de départ : une famille pauvre devient riche grâce au don de l'enfant (du temps transféré sur le compteur du père).
  - Personnages et rôles : le père (aimant puis exploiteur, devient le méchant), l'enfant (le don, l'épuisement, la fuite), la mère (espoir, puis disparaît), un vendeur (humiliation des pauvres), deux hommes (faux secours), une employée (la sauveuse).
  - Déclencheur : le compteur du père passe de 3 à 103 ans.
  - Montée : la faim réglée, l'humiliation au magasin effacée par l'argent, puis le père exige toujours plus (une île) alors que le don épuise l'enfant.
  - Retournement : l'enfant fuit, on le ramène, le père l'enferme derrière des barreaux « pour être un vrai père ».
  - Chute : une employée le découvre, ment au père, puis appelle la police en cachette. Le sauvetage reste hors champ.
  - Pourquoi l'histoire marche : le parent qui protège devient celui qui fait du mal (trahison de la promesse du début) ; une victime très lisible (ours, barreaux, grands yeux) ; un sauveur arrive, mais la fin reste suspendue.
- Hook (0-2 s) : un chiffre qui change à l'écran (3 → 103 ans) + « Oh mon Dieu, chéri, qu'est-ce qui est arrivé à ton compteur ? ». Le mystère est compris avant les règles.
- Structure : miracle grâce à l'enfant → espoir (« on n'aura plus jamais faim ? ») → le parent profite → exigences abusives → l'enfant s'épuise et fuit → la fuite échoue → enfermement → un tiers découvre la vérité → il agit en cachette (fin ouverte).
- Pourquoi ça a percé (si elle a percé) : mystère visible en une seconde, indignation contre le parent qui trahit, victime lisible et fin suspendue qui réclame une suite.
- Technique à retenir : plans plus longs (5 à 10 s) avec un lent rapprochement ; un chiffre écrit dans l'image porte l'histoire (attention à sa continuité, l'original se trompe) ; les barreaux entre le parent et l'enfant résument la relation en une image.
- Notre version : « Gaspard donne son temps » (3e format, créneau 21 h). Gardé : la méta des compteurs de temps façon « Time Out » (c'est elle qui fait buzzer, choix d'Ash), placés sur l'avant-bras ; le squelette entier ; la faim au début ; l'enfant épuisé ; la fuite ratée ; l'enfermement ; le mensonge du sauveur ; l'appel caché. Changé : le parent qui se corrompt est Lucie ; vendeur et faux secours fusionnés dans Lucie (duo) ; l'employée devient Mamie Jo (mère de Lucie) ; barreaux = porte de cave à claire-voie et soupirail ; police = gendarmerie ; refrain « plus jamais faim » qui se retourne ; toutes les répliques réécrites.
- Nos chiffres (J+1) :
- Leçon :

### 4. Elle pète de l'or (comédie) — @toons7078 (US) — vue le 2 oct. 2026
- Chiffres de l'original : non visibles ; durée 1 min 10 d'histoire, environ 40 plans (≈ 1,7 s par plan, le plus rapide des quatre)
- Ton : comédie absurde au début, drame sentimental au milieu, revanche à la fin
- Thème : être aimé pour ce qu'on rapporte ; avidité, exploitation, abandon
- SCÉNARIO
  - Situation de départ : dans un logement pauvre, une femme découvre que ses pets font apparaître des lingots d'or.
  - Personnages et rôles : la femme (le don, aimante, puis abandonnée), le compagnon (enthousiaste puis exploiteur, le méchant), un marchand (rend l'or concret, gag du mensonge), une nouvelle conquête (prépare l'abandon).
  - Déclencheur : les lingots dans le lit, le compagnon qui mord l'or « pour vérifier ».
  - Montée : il la gave pour produire plus, vend l'or en mentant (« à la mine, à force de travail »), villa et voitures, puis exige toujours plus.
  - Retournement : le don s'arrête, il la traite d'inutile, séduit une autre et part avec un sac.
  - Chute : seule et en larmes, elle produit un énorme diamant ; regard caméra : « Il n'a aucune idée de ce qu'il vient de perdre. » « À suivre ».
  - Pourquoi l'histoire marche : un gag absurde compris sans contexte ; un méchant qui devient détestable par étapes ; la revanche annoncée au moment le plus bas (le spectateur sait ce que le méchant ignore).
- Hook (0-2 s) : visuel, sans réplique : le phénomène impossible AVANT l'explication (nuage, lingots dans le lit). Première phrase à 3 s : « Mais qu'est-ce que c'est que ça ? »
- Structure : don qui enrichit le couple → le partenaire exige toujours plus → le don semble disparaître → il montre son vrai visage et part → un don supérieur apparaît → la victime prend l'avantage (phrase finale face caméra).
- Pourquoi ça a percé (si elle a percé) : idée absurde résumable en une phrase ; indignation contre le compagnon ; satisfaction de la revanche annoncée + envie de voir la suite.
- Technique à retenir : plans très courts (1 à 2 s), plan à deux pour l'action puis coupe sur celui qui parle et sur celui qui subit ; gros plans plus fréquents au moment des reproches ; sous-titres blancs à contour noir avec mots-clés en couleur ; carton final « À SUIVRE ».
- MOTIF QUI REVIENT (fiches 3 et 4) : « le don exploité » — un don (temps, or) enrichit la famille ou le couple, le proche devient avide et exploite celui qui a le don, puis l'abandonne ou l'enferme ; un tiers ou un don supérieur annonce la revanche. Deux comptes différents, même squelette : c'est un genre à part entière sur TikTok IA.
- Notre version : « Martine rote de l'or » (première comédie). Gardé : le squelette entier, l'or mordu, le gavage, le mensonge au marchand, la villa, « rien ? », l'abandon, le diamant, la phrase finale face caméra. Changé : le rot à la place du pet (plus logique avec le gavage, et la voix d'Agnes peut le faire) ; troupe à part (Martine, marmotte des Alpes ; Tony, raton laveur beauf en survêtement et chaîne en or) ; raclette, tartiflette, fondue ; magasin « On achète votre or » ; chalet de luxe avec jacuzzi ; la nouvelle conquête reste muette (duo) ; pas de moquerie sur le corps ; répliques réécrites (« Après tout ce que j'ai roté pour toi », « Les diamants, c'est éternel. Pas toi, Tony. »).
- Nos chiffres (J+1) :
- Leçon :

### 5. Démolir sa propre maison (partie 3 de « Dog swings alone ») — @nahreally.films (US) — vue le 3 oct. 2026
- Chiffres de l'original : non visibles ; durée 1 min d'histoire, environ 28 plans (≈ 2 s par plan)
- Ton : émotion, humiliation, puis promesse de revanche
- SCÉNARIO
  - Situation de départ : le père, qui dort dans sa camionnette, arrive sur un chantier de démolition : c'est la maison qu'il a construite.
  - Personnages et rôles : le père (subit, démolit lui-même), l'enfant (témoin, puis vengeur), le loup (humilie, remplace), la mère (« ce n'est que du personnel »), un chef de chantier (donne l'ordre, indifférent).
  - Déclencheur : « Prends une masse, on démolit tout. » / « C'est moi qui ai construit cette maison. »
  - Montée : il démonte lui-même ses balançoires ; la mère vante l'aire de jeux du loup ; le loup se moque de sa tenue orange.
  - Retournement : « Tu es meilleur pour détruire que pour construire. » Le toboggan neuf remplace les balançoires.
  - Chute : l'enfant, un dessin de famille à la main : « Tu as pris la maison de papa. Je vais te prendre tout ce que tu possèdes. » Regard caméra.
  - Pourquoi l'histoire marche : le héros participe à sa propre destruction ; l'amour de l'enfant contre le mépris des adultes ; le récit change de héros à la dernière seconde (l'enfant devient le vengeur).
- Hook (0-2 s) : visuel (camionnette avec un couchage = précarité), pas de réplique ; le vrai choc arrive à 13 s.
- Pourquoi ça a percé : injustice cruelle et concrète, contraste mépris / amour, promesse de revanche qui appelle la suite.
- Technique à retenir : objets qui racontent (camionnette, balançoire en bois, toboggan en plastique, dessin) ; pancartes écrites (« PROPERTY OF », « FUTURE SITE ») ; dernier plan très serré face caméra.
- Notre version : « Bruno se balance seul · Partie 3 » (5 oct. 19 h). Gardé : la structure entière, le gilet orange, la masse, « meilleur pour détruire », le toboggan, le dessin, la promesse finale face caméra. Changé : le hook parle dès la première seconde (le chef de chantier, un blaireau) ; Bruno démonte la balançoire du pommier en murmurant « Presque fini » (refrain de la partie 1 qui revient) ; pancarte « FUTURE AIRE DE JEUX DE GASPARD » ; Bruno repart avec l'assise de la balançoire sous le bras ; répliques réécrites.
- Nos chiffres (J+1) :
- Leçon :

### 9. Le fils dénonce le braquage (partie 4 de « Dog swings alone ») — @nahreally.films (US) — vue le 3 oct. 2026
- Chiffres de l'original : non visibles ; durée 1 min 12 d'histoire, environ 33 plans (≈ 2,2 s par plan)
- Ton : suspense et émotion, pas de comique
- Attention : l'analyse ChatGPT prend le loup pour le père ; dans la série, le loup est le riche (notre Marco), le chiot est le fils (Gaspard), la chatte est la mère (Lucie), « Dad » est le vrai père absent (Bruno). C'est la suite directe de la promesse de la partie 3 (« je vais te prendre tout ce que tu as »).
- SCÉNARIO
  - Situation de départ : le fils, seul avec le dessin de famille, parle à son père absent (« Je n'ai pas oublié, papa »).
  - Déclencheur : il surprend le loup et un complice (serpent) qui préparent le braquage d'une banque à minuit.
  - Montée : il appelle la police en cachette (« l'un d'eux est un loup ») ; le braquage semble réussir (« de l'argent facile »).
  - Retournement : gyrophares, le loup abandonne l'argent et s'enfuit.
  - Chute : de retour, il crie sur la mère : « Quelqu'un a parlé. Et je vais découvrir qui. » Le fils déchire son dessin et ferme sa porte.
  - Pourquoi l'histoire marche : IRONIE DRAMATIQUE (le spectateur sait qui a appelé, pas le méchant) ; la revanche promise commence mais met l'enfant en danger ; un objet (le dessin) revient trois fois.
- Hook (0-2 s) : « Je n'ai pas oublié, papa. » — mystère émotionnel, enfant seul.
- Pourquoi ça a percé (probable) : on sait un secret dangereux ; deux loyautés ; la menace finale appelle la suite.
- Technique à retenir : plans muets courts pour l'action (couloir, porte entrebâillée, voiture qui part, gyrophares, sac abandonné) ; lumière d'écran de téléphone sur le visage ; dialogues très courts.
- Notre version : « Bruno se balance seul · Partie 4 » (8 oct. 19 h). Gardé : structure, ironie dramatique, appel en cachette, braquage raté, menace finale, dessin déchiré. Changé : le complice n'apparaît pas (Marco au téléphone) ; Gaspard déchire le dessin « MA NOUVELLE FAMILLE » et garde celui de papa ; dernier plan : Lucie soupçonne.
- Nos chiffres (J+1) :
- Leçon :

<!-- Modèle de fiche :
### 6. L'appel déguisé en commande de pizza — @fruitstvdaily (FR) — vue le 3 oct. 2026
- Chiffres : non visibles dans le fichier. Durée 1 min 15 d'histoire. Fruits humanisés en 3D, en français.
- Histoire : un inconnu (pomme au sourire monstrueux) fait monter un enfant (orange) devant l'école en prétendant connaître son père ; portes verrouillées « pour ta sécurité » ; l'enfant appelle le 112 en commandant une pizza (« oui, et sans olives ») ; il donne sa position pendant que l'homme fait le plein ; appel découvert, l'enfant est retenu au sol ; gyrophares, fin sans sauvetage montré.
- Hook : « Salut petit, tes parents sont pas encore venus ? » + danger lisible dès la première image (visage du méchant).
- Montage : alterner visage de la victime, regard du méchant (rétroviseur) et écran du téléphone ; le texte du téléphone porte une partie du récit (« 112 », « Appel en cours »).
- Ressorts : ironie dramatique (on sait avant l'enfant), problème à résoudre en direct, danger et secours qui se rapprochent dans la même image à la fin.
- Notre usage : thème « L'appel déguisé », dans une autre situation (pas d'enlèvement d'enfant).

### 7. Le frère « sans pouvoir » — @lesminicontes11 (FR) — vue le 3 oct. 2026
- Chiffres : non visibles. Durée 1 min 13 d'histoire. Canettes humanisées en 3D, français, sous-titres blancs gras mot par mot.
- Histoire : quatre frères naissent, trois ont un pouvoir (feu, glace, énergie), le quatrième « rien de spécial » ; la mère : « Alors il aura encore plus d'amour que les autres. » Il dessine ses frères, qui l'humilient (ancêtre sans pouvoir, académie, entraînement raté) ; le frère du feu brûle ses dessins ; un élève lui dit que ses pouvoirs ont été désactivés à la naissance, une lumière dorée l'entoure.
- Hook : phrase choc vulgaire du médecin + quatre bébés dont un sans effet (différence comprise en 1 s).
- Ressorts : contraste univers enfantin / langage brutal (fait commenter), humiliation de toute l'identité, objet chéri détruit, fin qui fait relire tout le début (qui a désactivé ? quel don ?).
- Notre usage : thème « L'enfant sous-estimé et le don caché », sans vulgarité.

### 8. Trahi pour un diamant, il trouve une mine — @fruitwist.tv (FR) — vue le 3 oct. 2026
- Chiffres : non visibles. Durée 1 min 16 d'histoire. Fruits humanisés en 3D, français familier (« wesh »), sous-titres blancs en capitales à contour noir.
- Histoire : suspendu au-dessus des gorges du Verdon, le mari donne son diamant à sa femme qui promet de le remonter ; « T'aurais pas dû me faire confiance », elle le lâche. Il atterrit dans une mine de diamants. Elle ment au frère du mari, qui la console puis l'emmène dans le luxe. Le mari devenu patron de bijouterie apprend qu'elle est dans sa boutique : « Quand elle demandera le prix, tu m'appelles. » Elle : « Je demande même pas le prix, j'ai les moyens. » Lui, à l'étage : « C'est moi qui vais te le dire, cette fois. » « Partie 2 ?? ».
- Hook : danger + objet + lien affectif en 3 s (« Donne-moi ce diamant, mon cœur… »), sans présentation.
- Ressorts : injustice puis récompense disproportionnée ; ironie dramatique (on sait qu'il est le patron, pas elle) ; fin coupée avant la réponse ; un objet porte l'info dans chaque scène.
- Notre usage : thèmes « La trahison pour de l'argent » et « La revanche du sous-estimé ».

### N. Titre court — @compte (pays) — date
- Chiffres de l'original : vues, likes, commentaires, partages, durée
- Ton : comédie / émotion
- Thème :
- SCÉNARIO
  - Situation de départ (une phrase) :
  - Personnages et rôles (qui veut quoi, qui s'oppose) :
  - Déclencheur :
  - Montée :
  - Retournement :
  - Chute (la phrase ou l'image) :
  - Pourquoi l'histoire marche (enjeu universel, émotion visée) :
- Hook (0-2 s) :
- Structure plan par plan (résumé) :
- Pourquoi ça a percé (3 raisons max) :
- Technique à retenir (cadrage, caméra, montage, son) :
- Notre version : titre, date ; ce qu'on a gardé (histoire, structure, chute) ; ce qu'on a changé (personnages, décor, références françaises, répliques)
- Nos chiffres (J+1) : vues, % jusqu'au bout, partages, commentaires, abonnés
- Leçon :
-->


## Parodie de Koh-Lanta — deux vidéos Tentafruit étudiées (4 octobre 2026)

Consigne d’Ash : notre émission garde les codes de Koh-Lanta, avec des animaux adultes humanisés. Tentafruit sert à apprendre la narration sérielle et le montage ; notre moteur reste survie, tribus, confort, immunité, alliances, conseil et éliminations. Analyse détaillée : `analyse-tentafruit-pour-serie-survie.md`.

Observations : les ouvertures montrent un conflit à venir dans le même épisode, puis un rappel du précédent ; ne pas confondre teaser et récap. Le premier fichier annonce un jeu que le second développe réellement. Les confessionnaux apportent une interprétation ou une intention, et certains plans durent plusieurs secondes. L’ironie dramatique vient notamment du partenaire confiant après un rapprochement que le public a vu, et d’un malentendu que le public peut identifier. La deuxième fin montre un événement accompli et laisse ses conséquences ouvertes. Pas de statistiques fournies : ces procédés sont observés, leur effet sur la rétention reste à tester.

À appliquer : ouverture autonome ; rappel proposé de 2–3 secondes pour notre format, et non mesure du rappel des références ; confessionnaux qui changent la lecture ; tenir la promesse de la fin précédente ; varier les fins ; planifier l’arc de saison, les votes et les ressources. Chaque relation doit pouvoir influer sur le jeu.
