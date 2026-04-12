# 📋 PLAN CASHBACK DE PROPRETÉ — 2 SEMAINES
**Chef de projet : Matchim Vanelle**
**Deadline démo : début mai 2026**
**Généré le : 11 avril 2026**

---

## 🗺️ VUE D'ENSEMBLE DES 4 PHASES

| Phase | Contenu | Jours |
|-------|---------|-------|
| **Phase 1** | Hyzakam — OngletStatistiques | J1–J3 |
| **Phase 2** | Écran Citoyen — cohérence + cahier des charges | J4–J7 |
| **Phase 3** | Écran Responsable (complet) | J8–J10 |
| **Phase 4** | Écran Établissement + tests globaux | J11–J14 |

---

## ⚠️ PROBLÈMES DÉTECTÉS DANS LE CODE ACTUEL

### Problèmes bloquants / erreurs TypeScript
1. **`app/(tabs)/responsable.tsx`** → fichier coupé (`import React,`) — écran totalement vide
2. **`app/(tabs)/etablissement.tsx`** → `return null` — écran vide
3. **`components/citoyen/ongletCoupons.tsx`** → requête sur `depots` au lieu de `coupons`, champ `uid_citoyen` alors que Firestore utilise `id_citoyen`
4. **`components/citoyen/ongletCoupons.tsx`** → `BarCodeScanner` de `expo-barcode-scanner` est **déprécié** dans Expo SDK 55, doit être remplacé par `expo-camera` (méthode `Camera`)
5. **`components/citoyen/ongletHistorique.tsx`** → requête sur `depots` avec champs inexistants (`nom_etablissement`, `produit`, `reduction`) — l'historique citoyen doit lire la collection `coupons` (utilisés) + `depots`
6. **`components/citoyen/ongletPoints.tsx`** → TODO non résolu, `historique` est toujours vide `[]`
7. **`components/hyzakam/ongletGains.tsx`** → placeholder vide (`<Text>Gains</Text>`)
8. **`components/hyzakam/ongletStatistiques.tsx`** → utilise des arrow functions `=>` et ternaires partout (non conforme règles projet)
9. **`constants/animation.ts`** → `couleur.grey` a une valeur RGBA invalide (`#4741418c` — le `8c` est du hex, pas compatible avec la notation `#RRGGBB`)

### Incohérences avec le cahier des charges
10. **Coupons** : le cahier des charges dit *2 coupons générés à l'inscription par les Cloud Functions* (un grand, un petit) qui se débloquent indépendamment selon les points. Le code actuel ne respecte pas ce mécanisme (pas de seuil, pas de logique déblocage)
11. **Historique citoyen** : doit afficher l'**historique des dépôts** (pas des transactions coupons) — du plus récent au plus ancien, avec poids et points
12. **OngletPoints citoyen** : doit afficher côte du quartier (VERT/ORANGE/ROUGE), score sur 100 ET solde de points — pas seulement le solde
13. **Responsable** : doit scanner le QR code du citoyen pour l'identifier AVANT d'enregistrer un dépôt (3 étapes : catégorie → poids → confirmation tri)
14. **Signalement bac plein** : doit être **automatique** via Cloud Function quand le cumul de points distribués atteint la capacité du bac — pas un bouton manuel
15. **OngletStatistiques** : la vue "responsables" doit montrer les signalements de bac (vue signalement + vue responsable) selon cahier des charges

### Dépendances à surveiller (plan gratuit Firebase)
- Limite lectures Firestore : 50 000/jour — les composants qui font trop de `getDocs` sans `limit()` peuvent dépasser
- `ongletStatistiques.tsx` (1509 lignes) fait beaucoup de requêtes simultanées → optimiser avec `Promise.all` et `limit()`

---

## 📅 PHASE 1 — HYZAKAM ONGLETSTATISTIQUES (J1–J3)

### Objectif
Nettoyer, corriger et compléter `components/hyzakam/ongletStatistiques.tsx`.

### Ce qui existe déjà ✅
- 5 vues : `depots`, `semaines`, `contrats`, `gains`, `responsables`
- Graphiques VictoryNative (barres + lignes)
- Calcul multiplicateur alertes responsables
- Données contrats depuis `etablissements.montantContrat`

### Ce qu'il faut corriger / ajouter

**J1 — Nettoyage du code**
- [ ] Convertir toutes les arrow functions `=>` en `function` classiques
- [ ] Remplacer tous les ternaires `? :` par des `if/else`
- [ ] Ajouter `limit(50)` sur toutes les requêtes `getDocs` sans limite
- [ ] Corriger `couleur.grey` → utiliser `'rgba(71,65,65,0.55)'` directement
- [ ] Vérifier tous les noms de champs Firestore : `id_agent` pas `uid_agent`, `point` pas `points` dans `depots`

**J2 — Vue Signalements (manquante dans cahier des charges)**
- [ ] Ajouter une 6e vue `signalements` à la barre de navigation
- [ ] Afficher les signalements `traite == false` depuis collection `signalements`
- [ ] 2 sous-vues dans cette vue : **"Bacs pleins"** (type=bac_plein) et **"Infractions"** (type=infraction)
- [ ] Bouton "Marquer traité" → `updateDoc(signalement, { traite: true })`
- [ ] Afficher localisation du bac (récupérée via `bacs/{id_responsable}`)

**J3 — OngletGains (actuellement vide)**
- [ ] Créer `components/hyzakam/ongletGains.tsx` complet
- [ ] Afficher : revenus contrats du mois en cours (somme `montantContrat` de tous les `etablissements`), nombre de contrats actifs, projection annuelle
- [ ] Graphique en barres : revenus par mois (6 derniers mois) depuis `etablissements.updateAt`
- [ ] Carte économique : économies collecte (nombre signalements traités × coût estimé tournée = 5000 FCFA/tournée fixe)

---

## 📅 PHASE 2 — ÉCRAN CITOYEN (J4–J7)

### Fichiers concernés
- `app/(tabs)/citoyen.tsx`
- `components/citoyen/ongletAccueil.tsx`
- `components/citoyen/ongletCoupons.tsx`
- `components/citoyen/ongletHistorique.tsx`
- `components/citoyen/ongletPoints.tsx`

### J4 — Corriger OngletCoupons

**Erreurs à corriger :**
- Remplacer `expo-barcode-scanner` (déprécié SDK 55) par `expo-camera`
- Corriger la requête : lire depuis `coupons` (pas `depots`), avec `where('id_citoyen', '==', uid)`
- Corriger les champs : `statut` (pas `status`), `utilise` (booléen), `offre`, `id_etablissement`

**Logique cahier des charges à implémenter :**
- Afficher 2 onglets : **"Disponibles"** et **"Utilisés"**
- Pour chaque coupon disponible : compte à rebours 24h depuis création
- Un coupon bloqué (points insuffisants) = affiché en grisé avec le seuil manquant
- Quand coupon utilisé → l'autre coupon se bloque automatiquement (UI seulement, la logique est dans Cloud Function)

### J5 — Corriger OngletHistorique

**Ce que ça doit afficher (cahier des charges) :**
- Liste des **dépôts** du citoyen (collection `depots` où `id_citoyen == uid`)
- Colonnes : date formatée en français, catégorie, poids, points attribués, bonus tri (oui/non)
- Ordre : du plus récent au plus ancien
- `limit(30)` pour ne pas dépasser le quota Firebase

**Champs réels dans `depots` :** `id_citoyen`, `id_agent`, `date` (Timestamp), `point`

### J6 — Corriger OngletPoints

**Ce que ça doit afficher (cahier des charges) :**
- Solde de points actuel (depuis `utilisateurs/{uid}.point`)
- Équivalent en FCFA (1 point = 1 FCFA)
- Côte du quartier du citoyen : récupérer `quartier` depuis `utilisateurs/{uid}`, puis `cote` collection où `nom_quartier == quartier`
- Afficher niveau VERT/ORANGE/ROUGE avec score sur 100 et conséquences
- Si côte ROUGE : message "Votre quartier est en zone rouge — coupons limités à 25, 50 ou 100 points"

### J7 — Corriger OngletAccueil + Cohérence globale

**OngletAccueil — vérifications :**
- Afficher solde points + équivalent FCFA
- Afficher la liste des boutiques partenaires (`partenaires` collection) filtrables par nom
- Carte des bacs (OpenStreetMap/Leaflet) — version web : utiliser `leaflet` déjà installé
- Bouton de déconnexion (vers `app/login.tsx`)

**Cohérence globale citoyen :**
- [ ] Vérifier que le citoyen ne voit jamais les outils responsable/hyzakam
- [ ] Vérifier que `isFake` et données fictives sont bien supprimés en production
- [ ] Ajouter `limit()` partout
- [ ] Remplacer tous les `=>` par `function` dans les 4 composants

---

## 📅 PHASE 3 — ÉCRAN RESPONSABLE (J8–J10)

### Fichier : `app/(tabs)/responsable.tsx`

Fichier actuellement coupé — à recréer complètement.

### Architecture de l'écran

3 onglets internes (état `ongletActif`, pas expo-router) :

**Onglet 1 — "Scanner & Dépôt"** *(cœur du cahier des charges)*
- Étape 1 : Scanner QR code du citoyen (`expo-camera`) → identifier le citoyen
- Afficher nom du citoyen + indicateur éligibilité (pouce vert si actif) — **ne pas afficher son solde de points**
- Étape 2 : Choisir catégorie de déchets (mini/petit/moyen/grand) depuis `configuration` Firestore
- Étape 3 : Choisir poids parmi les options de la catégorie choisie
- Étape 4 : Confirmer le tri (bonus points si oui)
- Résumé avant confirmation : catégorie, poids, points calculés, bonus tri
- Bouton "Confirmer le dépôt" → appel Cloud Function (pas d'écriture directe des points)

**Onglet 2 — "Mon Bac"**
- Charger `bacs/{uid}` au montage
- Afficher : `localisation`, `etat`, barre de remplissage colorée (vert/orange/rouge selon `remplissage_actuel` 0-100), `capacite_max`, `derniere_collecte` formatée en français
- Afficher les dépôts d'aujourd'hui (requête `depots` où `id_agent == uid` et date = aujourd'hui)
- Total points distribués depuis dernière vidange

**Onglet 3 — "Historique"**
- Liste des 20 derniers dépôts enregistrés par ce responsable (`depots` où `id_agent == uid`, orderBy date desc, limit 20)
- Afficher : date, nom citoyen (récupérer depuis `utilisateurs/{id_citoyen}.nom`), poids estimé, points attribués

### Règles à respecter
- `function` classique partout, pas de `=>`
- `if/else` partout, pas de ternaires
- Commentaires en français niveau débutant
- Le responsable **ne voit jamais** le solde de points du citoyen

---

## 📅 PHASE 4 — ÉCRAN ÉTABLISSEMENT + TESTS (J11–J14)

### Fichier : `app/(tabs)/etablissement.tsx`

Actuellement : `return null` — à créer complètement.

### Ce que l'établissement doit pouvoir faire (cahier des charges)
- Tableau de bord : coupons validés aujourd'hui + total réductions accordées
- Scanner QR code d'un coupon citoyen (avec `expo-camera`)
- 3 vérifications automatiques : coupon existant → statut "disponible" → non expiré (< 24h)
- Si valide → `updateDoc(coupon, { statut: 'utilise', utilise: true })`
- Consulter ses offres configurées (depuis `etablissements/{uid}` → `produit_standard` et `produit_luxe`)
- Historique des coupons validés (depuis `coupons` où `id_etablissement == uid` et `utilise == true`)

### Architecture de l'écran
3 onglets internes :
- **"Scanner"** : scanner QR code coupon + afficher résultat validation
- **"Mes Offres"** : liste produits standard et luxe, avec seuils de points
- **"Historique"** : liste coupons validés avec date et reduction accordée

### J11–J12 : Développement établissement

### J13 — Tests globaux
- [ ] Tester le routing : login → redirection selon rôle
- [ ] Tester inscription citoyen (avec code quartier)
- [ ] Tester inscription responsable (avec code_secret RespoID)
- [ ] Tester inscription établissement (avec Id_contrat partenaires)
- [ ] Tester scan QR responsable → enregistrement dépôt
- [ ] Tester scan QR établissement → validation coupon
- [ ] Tester signalement bac plein automatique
- [ ] Vérifier Firestore Rules (toutes les collections)

### J14 — Corrections des bugs relevés + démo

---

## 🔥 FIRESTORE RULES COMPLÈTES À DÉPLOYER

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Utilisateurs : chacun lit/modifie uniquement son propre document
    match /utilisateurs/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Dépôts : citoyen lit les siens, responsable crée, hyzakam lit tout
    match /depots/{depotId} {
      allow read: if request.auth != null && resource.data.id_citoyen == request.auth.uid;
      allow read, create: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'responsable';
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Coupons : citoyen lit les siens, établissement lit + met à jour, hyzakam lit tout
    match /coupons/{couponId} {
      allow read: if request.auth != null && resource.data.id_citoyen == request.auth.uid;
      allow read, update: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'etablissement';
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Établissements : établissement lit le sien, hyzakam RW, citoyen lit pour voir les offres
    match /etablissements/{etabId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Partenaires : hyzakam RW, autres lisent pour l'inscription
    match /partenaires/{partenaireId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // RespoID : hyzakam RW, responsable lit le sien (pour l'inscription)
    match /RespoID/{respoId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Bacs : hyzakam RW, responsable lit + met à jour le sien
    match /bacs/{bacId} {
      allow read: if request.auth != null && request.auth.uid == bacId;
      allow update: if request.auth != null && request.auth.uid == bacId;
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Signalements : tous les rôles peuvent créer, hyzakam met à jour (traite)
    match /signalements/{signalId} {
      allow read, create: if request.auth != null;
      allow update: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Côte quartiers : tout le monde lit (même sans connexion selon CDC)
    match /cote/{coteId} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Configuration : lecture pour tous les authentifiés (barème points)
    match /configuration/{configId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }

    // Alertes : hyzakam seulement
    match /alertes/{alerteId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role == 'hyzakam';
    }
  }
}
```

---

## 📦 COULEUR.GREY — CORRECTION REQUISE

Dans `constants/animation.ts`, remplacer :
```ts
grey:'#4741418c'  // ❌ invalide
```
Par :
```ts
grey:'rgba(71,65,65,0.55)'  // ✅ correct
```

---

## 📱 EXPO-BARCODE-SCANNER → MIGRATION REQUISE

`expo-barcode-scanner` est déprécié dans Expo SDK 55.

**Remplacer dans tous les fichiers qui l'utilisent :**
```ts
// ❌ Avant
import { BarCodeScanner } from 'expo-barcode-scanner';
<BarCodeScanner onBarCodeScanned={handler} style={{ flex: 1 }} />

// ✅ Après
import { CameraView, useCameraPermissions } from 'expo-camera';
const [permission, requestPermission] = useCameraPermissions();
<CameraView onBarcodeScanned={handler} style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
```

---

## 🧾 CHAMPS FIRESTORE — RÉFÉRENCE OFFICIELLE

| Collection | Champs réels |
|-----------|-------------|
| `utilisateurs` | `uid`, `role`, `point`, `total_reductions`, `email`, `nom`, `quartier`, `ville` |
| `depots` | `id_citoyen`, `id_agent`, `date` (Timestamp), `point` |
| `coupons` | `id_citoyen`, `code`, `points`, `statut` (disponible/utilisé/expiré), `id_etablissement`, `offre`, `utilise` (bool) |
| `etablissements` | `createAt`, `id_contrat`, `id_etablissement`, `nom`, `produit_luxe[]`, `produit_standard[]`, `montantContrat`, `updateAt`, `dateRenouvellement` |
| `alertes` | `nom`, `multiplicateur`, `date`, `traite`, `occurence` |
| `bacs` | `capacite_max`, `derniere_collecte`, `etat`, `localisation`, `remplissage_actuel` |
| `cote` | `nom_quartier`, `score_total` |
| `signalements` | `id_auteur`, `type`, `latitude`, `longitude`, `traite` |
| `partenaires` | `NomEntreprise`, `ville`, `statut`, `Id_contrat`, `Numero_de_telephone`, `date_demande`, `email` |
| `RespoID` | `code_secret`, `date_demande`, `email`, `nom`, `numero_de_telephone`, `point_depot`, `statut`, `utilise` |
| `configuration` | `zones`, `categorie_mini`, `categorie_petit`, `categorie_moyen`, (+ grand bac) |

---

*Ce fichier est la référence centrale du projet. Mettre à jour après chaque phase terminée.*
