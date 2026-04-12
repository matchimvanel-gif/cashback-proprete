const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Limite d'instances Cloud Functions
functions.setGlobalOptions({ maxInstances: 10 });

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function convertirEnDate(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur;
  if (typeof valeur.toDate === "function") return valeur.toDate();
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleJour(date) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

async function compterDepotsParResponsable(dateDebut, dateFin) {
  const snapshot = await db
    .collection("depots")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(dateDebut))
    .where("date", "<=", admin.firestore.Timestamp.fromDate(dateFin))
    .get();

  const comptes = {};
  snapshot.forEach((doc) => {
    const depot = doc.data();
    const respoId = depot.id_agent || depot.responsableId || depot.respoID || null;
    if (!respoId) return;
    comptes[respoId] = (comptes[respoId] || 0) + 1;
  });
  return comptes;
}

async function calculerMoyenneGlissanteResponsable(responsableId, debutAujourdHui) {
  const debutHistorique = new Date(debutAujourdHui);
  debutHistorique.setDate(debutHistorique.getDate() - 7);

  const finHistorique = new Date(debutAujourdHui);
  finHistorique.setMilliseconds(finHistorique.getMilliseconds() - 1);

  const snapshot = await db
    .collection("depots")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(debutHistorique))
    .where("date", "<=", admin.firestore.Timestamp.fromDate(finHistorique))
    .get();

  const compteParJour = {};
  snapshot.forEach((doc) => {
    const depot = doc.data();
    const idTrouve = depot.id_agent || depot.responsableId || depot.respoID || null;
    if (idTrouve !== responsableId) return;
    const dateDepot = convertirEnDate(depot.date);
    if (!dateDepot) return;
    const jour = cleJour(dateDepot);
    compteParJour[jour] = (compteParJour[jour] || 0) + 1;
  });

  const jours = Object.keys(compteParJour);
  const total = jours.reduce((acc, j) => acc + compteParJour[j], 0);
  return {
    moyenne: jours.length > 0 ? total / jours.length : 0,
    nbJoursAvecActivite: jours.length,
  };
}

async function recupererNomResponsable(responsableId) {
  try {
    const doc = await db.collection("utilisateurs").doc(responsableId).get();
    if (!doc.exists) return "Responsable inconnu";
    const data = doc.data() || {};
    return data.nom || data.name || "Responsable inconnu";
  } catch (e) {
    return "Responsable inconnu";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENREGISTRER UN DÉPÔT + CRÉDITER LES POINTS + METTRE À JOUR LE BAC
//    Appelée par l'écran responsable.tsx quand il valide un dépôt citoyen.
//    C'est la seule façon de créditer des points (règle de sécurité).
// ─────────────────────────────────────────────────────────────────────────────
exports.enregistrerDepot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }

  const {
    citoyenId,
    respoId,
    bacId,
    categorie,
    poids,
    pointsBase,
    bonusTri,
    tri,
  } = data;

  if (!citoyenId || !respoId || !bacId || !categorie || !poids || pointsBase === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Données incomplètes");
  }

  const totalPoints = pointsBase + (bonusTri || 0);
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  // Vérifier que le citoyen existe
  const citoyenRef = db.collection("utilisateurs").doc(citoyenId);
  const citoyenSnap = await citoyenRef.get();
  if (!citoyenSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Citoyen introuvable");
  }

  // Vérifier que le bac existe
  const bacRef = db.collection("bacs").doc(bacId);
  const bacSnap = await bacRef.get();
  if (!bacSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Bac introuvable");
  }

  const bacData = bacSnap.data();
  const capaciteMax = bacData.capacite_points || 50000; // 50kg = 50000 points par défaut
  const pointsActuels = bacData.points_cumules || 0;
  const nouveauxPointsBac = pointsActuels + totalPoints;

  const batch = db.batch();

  // Créer le document dépôt (immuable — jamais modifiable ni supprimable)
  const depotRef = db.collection("depots").doc();
  batch.set(depotRef, {
    citoyenId,
    respoID: respoId,
    bacId,
    categorie,
    poids,
    pointsBase,
    bonusTri: bonusTri || 0,
    tri: tri || false,
    totalPoints,
    date: maintenant,
    createdAt: maintenant,
  });

  // Créditer les points du citoyen (seule façon autorisée)
  batch.update(citoyenRef, {
    points: admin.firestore.FieldValue.increment(totalPoints),
    updatedAt: maintenant,
  });

  // Mettre à jour le compteur du bac
  batch.update(bacRef, {
    points_cumules: nouveauxPointsBac,
    updatedAt: maintenant,
  });

  await batch.commit();

  // Vérifier si le bac est plein et créer un signalement automatique
  if (nouveauxPointsBac >= capaciteMax) {
    await db.collection("signalements").add({
      bacId,
      respoId,
      type: "bac_plein",
      traite: false,
      pointsCumules: nouveauxPointsBac,
      capaciteMax,
      date: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Signalement automatique créé pour le bac ${bacId}`);
  }

  // Mettre à jour la côte du quartier du citoyen
  const quartier = citoyenSnap.data().quartier;
  if (quartier) {
    const coteRef = db.collection("cote").doc(quartier);
    const coteSnap = await coteRef.get();

    if (coteSnap.exists) {
      const scoreActuel = coteSnap.data().score_total || 0;
      const nouveauScore = Math.min(100, scoreActuel + totalPoints * 0.001);
      await coteRef.update({
        score_total: nouveauScore,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  return {
    success: true,
    depotId: depotRef.id,
    pointsCredites: totalPoints,
    bacPlein: nouveauxPointsBac >= capaciteMax,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRAITER UN SIGNALEMENT DE BAC PLEIN
//    Hyzakam appuie sur "Traiter" dans ongletAccueil.
//    → Marque le signalement traité + remet le compteur du bac à 0.
// ─────────────────────────────────────────────────────────────────────────────
exports.traiterSignalement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }

  const { signalementId, bacBienRempli } = data;

  if (!signalementId) {
    throw new functions.https.HttpsError("invalid-argument", "signalementId requis");
  }

  const signalementRef = db.collection("signalements").doc(signalementId);
  const signalementSnap = await signalementRef.get();

  if (!signalementSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Signalement introuvable");
  }

  const signalementData = signalementSnap.data();
  const bacId = signalementData.bacId;
  const respoId = signalementData.respoId;

  const batch = db.batch();
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  // Marquer le signalement comme traité
  batch.update(signalementRef, {
    traite: true,
    bacBienRempli: bacBienRempli !== false,
    traiteLe: maintenant,
    updatedAt: maintenant,
  });

  // Remettre le compteur du bac à 0
  if (bacId) {
    const bacRef = db.collection("bacs").doc(bacId);
    batch.update(bacRef, {
      points_cumules: 0,
      derniere_vidange: maintenant,
      updatedAt: maintenant,
    });
  }

  await batch.commit();

  // Si le bac n'était pas bien rempli → signaler le responsable à la direction
  if (bacBienRempli === false && respoId) {
    await db.collection("alertes_direction").add({
      respoId,
      bacId,
      signalementId,
      motif: "Bac signalé plein mais constaté non rempli lors de la vidange",
      traite: false,
      date: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    success: true,
    bacRemisAZero: !!bacId,
    alerteDirectionCreee: bacBienRempli === false && !!respoId,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. VALIDER UN ÉTABLISSEMENT PARTENAIRE
//    Hyzakam valide manuellement après vérification du contrat.
// ─────────────────────────────────────────────────────────────────────────────
exports.validerEtablissement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }

  const { etablissementId, montantContrat } = data;

  if (!etablissementId) {
    throw new functions.https.HttpsError("invalid-argument", "etablissementId requis");
  }

  const etablissementRef = db.collection("etablissements").doc(etablissementId);
  const snap = await etablissementRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Établissement introuvable");
  }

  const dateRenouvellement = new Date();
  dateRenouvellement.setDate(dateRenouvellement.getDate() + 30);

  await etablissementRef.update({
    statut: "valide",
    montantContrat: montantContrat || 25000,
    dateRenouvellement: admin.firestore.Timestamp.fromDate(dateRenouvellement),
    valide_le: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, etablissementId };
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CRÉER DES COUPONS POUR UN CITOYEN
//    Appelée automatiquement à l'inscription d'un citoyen.
//    Crée 2 coupons bloqués (un grand, un petit).
//    C'est la seule façon de créer des coupons (règle de sécurité).
// ─────────────────────────────────────────────────────────────────────────────
exports.creerCouponsCitoyen = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }

  const { citoyenId } = data;

  if (!citoyenId) {
    throw new functions.https.HttpsError("invalid-argument", "citoyenId requis");
  }

  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  const batch = db.batch();

  // Coupon petit — seuil de déblocage : 50 points
  const couponPetitRef = db.collection("coupons").doc();
  batch.set(couponPetitRef, {
    citoyenId,
    type: "petit",
    valeur: 50,
    statut: "bloque",
    seuilDeblocage: 50,
    dateCreation: maintenant,
    createdAt: maintenant,
  });

  // Coupon grand — seuil de déblocage : 200 points
  const couponGrandRef = db.collection("coupons").doc();
  batch.set(couponGrandRef, {
    citoyenId,
    type: "grand",
    valeur: 200,
    statut: "bloque",
    seuilDeblocage: 200,
    dateCreation: maintenant,
    createdAt: maintenant,
  });

  await batch.commit();

  return {
    success: true,
    couponPetitId: couponPetitRef.id,
    couponGrandId: couponGrandRef.id,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DÉBLOQUER LES COUPONS D'UN CITOYEN
//    Vérifie si le citoyen a atteint les seuils et débloque les coupons.
//    Déclenché automatiquement après chaque dépôt validé.
// ─────────────────────────────────────────────────────────────────────────────
exports.verifierDeblocageCoupons = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }

  const { citoyenId } = data;

  if (!citoyenId) {
    throw new functions.https.HttpsError("invalid-argument", "citoyenId requis");
  }

  const citoyenSnap = await db.collection("utilisateurs").doc(citoyenId).get();
  if (!citoyenSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Citoyen introuvable");
  }

  const pointsCitoyen = citoyenSnap.data().points || 0;

  // Récupérer les coupons bloqués du citoyen
  const couponsSnap = await db
    .collection("coupons")
    .where("citoyenId", "==", citoyenId)
    .where("statut", "==", "bloque")
    .get();

  if (couponsSnap.empty) {
    return { success: true, couponsDebloques: 0 };
  }

  const batch = db.batch();
  let couponsDebloques = 0;
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  couponsSnap.forEach((doc) => {
    const coupon = doc.data();
    if (pointsCitoyen >= coupon.seuilDeblocage) {
      const dateExpiration = new Date();
      dateExpiration.setHours(dateExpiration.getHours() + 24);

      batch.update(doc.ref, {
        statut: "disponible",
        dateDeblocage: maintenant,
        dateExpiration: admin.firestore.Timestamp.fromDate(dateExpiration),
        updatedAt: maintenant,
      });
      couponsDebloques++;
    }
  });

  if (couponsDebloques > 0) {
    await batch.commit();
  }

  return { success: true, couponsDebloques };
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DÉTECTION AUTOMATIQUE DES RESPONSABLES SUSPECTS
//    Tournée toutes les 60 minutes — compare les dépôts du jour à la moyenne.
//    Crée une alerte si multiplicateur >= 2 et au moins 5 dépôts.
// ─────────────────────────────────────────────────────────────────────────────
async function analyserResponsablesSuspects() {
  const maintenant = new Date();
  const debutAujourdHui = new Date(maintenant);
  debutAujourdHui.setHours(0, 0, 0, 0);
  const finAujourdHui = new Date(maintenant);
  finAujourdHui.setHours(23, 59, 59, 999);

  const comptesDuJour = await compterDepotsParResponsable(debutAujourdHui, finAujourdHui);
  const responsables = Object.keys(comptesDuJour);
  let nombreAlertes = 0;

  for (const respoId of responsables) {
    const depotsAujourdHui = comptesDuJour[respoId];
    if (depotsAujourdHui < 5) continue;

    const historique = await calculerMoyenneGlissanteResponsable(respoId, debutAujourdHui);
    if (historique.nbJoursAvecActivite < 2 || historique.moyenne <= 0) continue;

    const multiplicateur = Number((depotsAujourdHui / historique.moyenne).toFixed(2));
    if (multiplicateur < 2) continue;

    const nom = await recupererNomResponsable(respoId);
    const jour = cleJour(maintenant);
    const alerteId = `${respoId}_${jour}`;

    await db.collection("alertes").doc(alerteId).set({
      nom,
      responsableId: respoId,
      multiplicateur,
      occurence: depotsAujourdHui,
      depotsAujourdHui,
      moyenneHabituelle: Number(historique.moyenne.toFixed(2)),
      traite: false,
      date: admin.firestore.Timestamp.fromDate(maintenant),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    nombreAlertes++;
  }

  return {
    success: true,
    analysedResponsables: responsables.length,
    alertesCreeesOuMisesAJour: nombreAlertes,
  };
}

exports.detecterResponsablesSuspects = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }
  return analyserResponsablesSuspects();
});

exports.verifierAlertesResponsables = functions.pubsub
  .schedule("every 60 minutes")
  .timeZone("Africa/Douala")
  .onRun(async () => {
    const resultat = await analyserResponsablesSuspects();
    console.log("Analyse alertes responsables:", resultat);
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 7. METTRE À JOUR LA CÔTE D'UN QUARTIER
//    Recalcule le score sur 100 à partir des points de tous les citoyens.
//    Appelée manuellement par Hyzakam ou automatiquement après un dépôt.
// ─────────────────────────────────────────────────────────────────────────────
exports.recalculerCoteQuartier = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Connexion requise");
  }

  const { quartier } = data;
  if (!quartier) {
    throw new functions.https.HttpsError("invalid-argument", "quartier requis");
  }

  const citoyensSnap = await db
    .collection("utilisateurs")
    .where("quartier", "==", quartier)
    .where("role", "==", "citoyen")
    .get();

  if (citoyensSnap.empty) {
    return { success: true, score: 0, quartier };
  }

  let totalPoints = 0;
  citoyensSnap.forEach((doc) => {
    totalPoints += doc.data().points || 0;
  });

  const nbCitoyens = citoyensSnap.size;
  const moyenneParCitoyen = totalPoints / nbCitoyens;

  // Score sur 100 : 1000 points en moyenne = score 100
  const score = Math.min(100, Math.round(moyenneParCitoyen / 10));

  await db.collection("cote").doc(quartier).set({
    quartier,
    score_total: score,
    totalPoints,
    nbCitoyens,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, score, quartier, nbCitoyens, totalPoints };
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. RENOUVELLEMENT AUTOMATIQUE DES CONTRATS ÉTABLISSEMENTS
//    Gardée ici pour centraliser — aussi lancée par GitHub Actions (scripts/).
// ─────────────────────────────────────────────────────────────────────────────
exports.addMontantToExistingEtablissements = functions.https.onCall(
  async (data, context) => {
    if (!context.auth || context.auth.uid !== "cJdPoZIqE8a6hnSmPNO348TB2hI2") {
      throw new functions.https.HttpsError("permission-denied", "Accès réservé à l'admin");
    }

    const snapshot = await db.collection("etablissements").get();
    if (snapshot.empty) return { success: true, message: "Aucun établissement trouvé" };

    const maintenant = admin.firestore.Timestamp.now();
    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.montantContrat === undefined || data.dateRenouvellement === undefined) {
        batch.update(doc.ref, {
          montantContrat: 25000,
          dateRenouvellement: maintenant,
          createdAt: data.createdAt || maintenant,
          updatedAt: maintenant,
        });
        updatedCount++;
      }
    });

    await batch.commit();
    return { success: true, updatedCount };
  });
// ─────────────────────────────────────────────────────────────────────────────
// 9. EXPIRATION AUTOMATIQUE DES COUPONS (CRON)
// ─────────────────────────────────────────────────────────────────────────────
exports.expirerCouponsPerimes = functions.pubsub
  .schedule("0 1 * * *") // Tourne tous les jours à 01h00 du matin
  .timeZone("Africa/Douala")
  .onRun(async (context) => {
    const maintenant = admin.firestore.Timestamp.now();
    
    const couponsExpirables = await db.collection("coupons")
      .where("statut", "==", "disponible")
      .where("dateExpiration", "<", maintenant)
      .get();

    if (couponsExpirables.empty) return null;

    const batch = db.batch();
    couponsExpirables.forEach((doc) => {
      batch.update(doc.ref, { 
        statut: "expire",
        updatedAt: maintenant 
      });
    });

    await batch.commit();
    console.log(`${couponsExpirables.size} coupons passés en expiré.`);
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 10. SYNTHÈSE DES STATISTIQUES (OPTIMISATION LECTURE)
//     Met à jour un document unique pour éviter de recalculer les graphiques.
// ─────────────────────────────────────────────────────────────────────────────
exports.majStatsGlobales = functions.firestore
  .document("depots/{depotId}")
  .onCreate(async (snap, context) => {
    const depot = snap.data();
    const jour = cleJour(new Date());
    const statsRef = db.collection("stats_globales").doc(jour);

    return statsRef.set({
      totalPointsJour: admin.firestore.FieldValue.increment(depot.totalPoints || 0),
      totalDepotsJour: admin.firestore.FieldValue.increment(1),
      derniereMaj: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

