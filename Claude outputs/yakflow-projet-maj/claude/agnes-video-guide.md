# Agnes Video et Image : ce qu'il faut savoir (doc officielle, lue le 6 oct. 2026)

Source : https://wiki.agnes-ai.com/llms.txt (pages Video 2.5 Flash, Video 2.5, Image 2.5 Flash, Token Plan FAQ, Pricing, Error Codes, CGU).

## Agnes Video 2.5 Flash (modèle utilisé par YakFlow)
- `POST /v1/videos` puis `GET /agnesapi?video_id=…&model_name=agnes-video-2.5-flash` (toujours mettre model_name). Statuts Flash : pending, completed, failed. Terminé seulement si `status = completed` ET `url` présent.
- Champs : model, prompt, mode (`text` | `keyframe` | `reference`), seconds en chaîne "4" à "12" (défaut "5"), size = "720P" obligatoire, aspect_ratio (21:9, 16:9, 4:3, 1:1, 3:4, 9:16 ; défaut 16:9), seed (entier, reproductibilité), n = 1.
- Keyframe : `first_frame` et/ou `last_frame` (la doc parle d'URL publique ; YakFlow envoie une data URI base64, ce qui marche en pratique).
- Reference : `images` (5 max), `audios` (3 max), pas de vidéo. Dans le prompt : `<Picture 1>`, `<Audio 1>` en disant le rôle de chacun.
- 9:16 = 720×1280. Actuellement gratuit (0 $/s, prix catalogue 0,025 $/s).
- Génère aussi le son (ambiance, bruits, voix décrits dans le prompt).

## Écrire un bon prompt vidéo (ordre recommandé par Agnes)
1. Sujet et décor (qui, où, quand)
2. Action et évolution de la scène
3. Caméra : push-in, pull-out, pan, tilt, tracking, plan fixe, valeur de plan
4. Style : lumière, couleurs, matières, ambiance
5. Son et rythme : ambiance, bruits d'action, voix
6. Continuité : ce qui ne doit pas changer
En keyframe, partir de l'image : « The person turns naturally from the first-frame pose… ». Une action principale par clip de 4 à 6 s. Pas de nouveau texte à l'écran. Réplique entre guillemets avec la langue et le ton.

## Agnes Image 2.5 Flash
- `POST /v1/images/generations`, synchrone. size 1K/2K/3K/4K + `ratio`. Références dans `extra_body.image` (URL ou base64), `response_format` dans `extra_body`.
- Prompt : sujet + décor + style + lumière + composition + qualité. En image-to-image, dire ce qui change et ce qui est conservé, et le rôle de chaque image jointe.

## Limites (par type de clé, partagées entre toutes les clés du même compte)
- Vidéo : gratuit 1 requête/min effective, entreprise 2, Token Plan 5.
- Image gratuit : 1K = 10/min, 2K = 5/min, 3K et 4K = 1/min.
- Token Plan : 500 s de vidéo/jour et 4 000 images/jour en plus des limites par minute.
- Une clé gratuite et une clé Token Plan du même compte ont des limites séparées.
- 429 : attendre 1 min / Retry-After. 409 : soumission en double. 402 : quota ou solde.
- CGU : interdit de contourner les limites de débit, et de partager ses clés API avec un tiers.

## Réglages YakFlow qui en découlent (V13)
- Images en 2K par défaut (au lieu de 4K) : 5× plus de débit en gratuit, aucune perte visible en 720P.
- Formats 2:3 / 3:2 convertis en 3:4 / 4:3 pour la vidéo, première image recadrée au format exact.
- Consigne de continuité ajoutée aux prompts Agnes (désactivable dans les réglages).
- Écart de 65 s entre deux clips par clé gratuite, 15 s en Token Plan.

## Réglages YakFlow V14 (6 oct. 2026, soir)
- `imageFin` dans les scènes : la vidéo part en mode keyframe avec `first_frame` + `last_frame` (recadrés au format exact). La scène attend que les deux images soient prêtes.
- Lien `?code=XXXX` : active automatiquement l'accès premium à l'ouverture de YakFlow.
- Leçons d'écriture : voir `regles-prompts-agnes.md` (débit ≈ 3 mots/s, réplique finie une seconde avant la fin, noms phonétiques, caméra variée).
