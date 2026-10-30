# FranceStudent Chat pour iPhone — SideStore

Version iPhone du même chat que l'application Android. Minimum : **iOS 16.4**.

Le projet contient l'interface complète, les projets et réglages, la dictée vocale,
la connexion native et l'enregistrement des fichiers dans l'app **Fichiers**.

## Obtenir l'IPA sans Mac personnel

La compilation doit s'exécuter sur macOS avec Xcode. Le workflow
`.github/workflows/build-iphone.yml` utilise une machine macOS de GitHub Actions.
Il construit un IPA **non signé**, sans identifiant Apple ni certificat dans GitHub.
SideStore se charge ensuite de la signature sur l'iPhone.

1. Mettre le dossier `android-app` et `.github` à la racine d'un dépôt GitHub.
2. Ouvrir **Actions → Compiler FranceStudent pour SideStore → Run workflow**.
3. Attendre la fin de la compilation, puis télécharger l'artefact
   **FranceStudent-iPhone-SideStore** depuis la page du run.
4. Décompresser cet artefact : il contient `FranceStudent-iPhone.ipa`.
5. Sur l'iPhone où SideStore est déjà configuré, ouvrir **SideStore → My Apps → +**
   et sélectionner l'IPA dans Fichiers. Accepter la signature avec son propre compte Apple.

Une archive ZIP des sources ne s'installe pas dans SideStore. Il faut l'IPA produit
par une compilation réussie. Les limites et renouvellements dépendent du compte
Apple et de la configuration SideStore ; aucun compte Apple n'est stocké ici.

## Compiler sur un Mac

Prérequis : Xcode 16 ou ultérieur, Node.js 22 ou ultérieur, CocoaPods.

```bash
cd android-app
npm ci
npm run ipa
```

Résultat : `android-app/dist/FranceStudent-iPhone.ipa`.
Le script refuse une exécution sous Windows et cible un véritable appareil arm64,
pas un simulateur. Il lance `cap sync ios` avant chaque compilation.

## Fichiers et autorisations

- Les fichiers téléchargés se trouvent dans **Fichiers → Sur mon iPhone → FranceStudent Chat**.
- Le microphone et la reconnaissance vocale sont demandés pour la dictée.
- La caméra et les photos sont utilisées lorsqu'on joint une image ou change l'avatar.
- La connexion au compte utilise les mêmes serveurs FranceStudent que l'application Android.
- Le clavier, l'encoche et la zone d'accueil iOS sont pris en compte par l'interface.
- Pour créer une présentation à partir d’un sujet ou de documents joints, demander « Crée un PowerPoint de 5 diapositives sur… ». Le fichier `.pptx`, modifiable et accompagné de notes si fournies, se télécharge depuis la réponse comme les autres documents. La génération du fichier s'effectue sur le téléphone, sans service de conversion externe.
- Après une mise à jour de PptxGenJS, `npm run vendor:powerpoint` actualise le générateur embarqué et ses licences.

## Vérifications

```bash
node scripts/verify-iphone.cjs
node test-restoration.cjs
node test-general-settings.cjs
node test-mcp-wizard.cjs
node test-projects-activity.cjs
node test-message-actions.cjs
node test-mobile-input.cjs
node test-powerpoint.cjs
```

Ces vérifications ne remplacent pas une compilation Xcode ni un essai sur iPhone.

Références : [Capacitor 7 iOS](https://capacitorjs.com/docs/v7/ios),
[installation de SideStore](https://docs.sidestore.io/docs/installation/install).

## Mises à jour dans SideStore

Ajouter une seule fois cette URL dans les sources de SideStore :

`https://raw.githubusercontent.com/SrxKirito/Francestudent-Iphone/main/source.json`

Chaque modification de l’application sur `main` déclenche la compilation. Après les tests et une compilation réussie, le workflow publie une Release GitHub avec l’IPA et la source. La version iOS augmente à chaque nouveau run ; le numéro et la taille annoncés sont extraits de l’IPA compilé. SideStore peut ensuite proposer la mise à jour directement. L’installation et la signature restent gérées par SideStore.

## Reprise, bibliothèque et notifications locales

Le client sauvegarde les réponses en attente, le texte reçu et le dernier identifiant SSE. Au retour, il utilise `GET /chats/{chatId}/stream?last_event_id=…` pour reprendre le flux existant, sans renvoyer le message au modèle. Si le flux n’est plus disponible, il recherche la réponse enregistrée dans le chat. La conservation et la durée de vie des générations restent gérées par le serveur FranceStudent.

La Bibliothèque regroupe localement les pièces jointes originales, les fichiers générés et les images. Elle propose recherche, filtres, aperçu, enregistrement et classement dans un projet. Les originaux déjà perdus dans les anciennes versions ne peuvent pas être recréés à partir du texte extrait.

Le bouton de notifications de la Bibliothèque demande l’autorisation iOS. Une notification locale est produite si le transport natif reçoit la fin du flux alors que l’app est en arrière-plan. Cela ne fournit pas de notification APNs lorsque l’app est complètement arrêtée : l’intégration d’un service push côté serveur et une signature disposant des capacités APNs seraient nécessaires.
