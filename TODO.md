# TODO - Mise à jour Vue Responsable & DB Fixes

## Étape 1: Corriger commentaires & queries dans ongletStatistiques.tsx [DONE ✓]
- Remplacer "vue reponsable" → "vue responsable"
- Query RespoID au lieu de 'responsables'
- Data réelle depuis etablissements.montantContrat
- Ajouter implémentation vue "responsables" (liste RespoID, bacs, alertes)

## Étape 2: Créer app/(tabs)/responsable.tsx [DONE ✓]
- Dashboard responsable: statut bacs (remplissage_actuel), depots, signalements bac_plein

## Étape 3: Updater firestore.rules [DONE ✓]
- Permissions RespoID/bacs (hyzakam RW, responsables read own)

## Étape 4: Tests & Deploy [PENDING]
- npx expo start, login hyzakam → vue stats/responsables
- firebase deploy --only firestore:rules

French comments everywhere, no deletions, junior-friendly.
