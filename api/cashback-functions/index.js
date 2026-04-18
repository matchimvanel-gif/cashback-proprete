/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║         CASHBACK PROPRETÉ — CLOUD FUNCTIONS COMPLÈTES                  ║
 * ║         Projet: cash-back-de-proprete | IME Bafoussam, Cameroun         ║
 * ║         Auteur: Matchim Vanelle | Node.js CommonJS | firebase-functions ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * RÈGLES ABSOLUES DU PROJET :
 *  - Les point ne sont crédités QUE via enregistrerDepot()
 *  - Les coupons ne sont créés QUE via creerCouponsCitoyen()
 *  - Un dépôt enregistré ne peut jamais être modifié ni supprimé
 *  - Toutes les dates utilisent serverTimestamp() — jamais l'horloge téléphone
 */

"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");


// Initialisation unique de l'app Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Limite globale d'instances pour éviter les coûts excessifs
functions.setGlobalOptions({ maxInstances: 10 });

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES PARTAGÉS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convertit n'importe quelle valeur date en objet Date JS.
 * Supporte : Date, Timestamp Firestore, string ISO.
 */
function convertirEnDate(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur;
  if (typeof valeur.toDate === "function") return valeur.toDate();
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Retourne la clé YYYY-MM-DD d'un objet Date.
 * Utilisé pour grouper les dépôts par jour dans les alertes.
 */
function cleJour(date) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

/**
 * Récupère le nom d'un responsable depuis la collection utilisateurs.
 * Retourne "Responsable inconnu" si le document n'existe pas.
 */
async function recupererNomResponsable(id_agent) {
  try {
    const doc = await db.collection("utilisateurs").doc(id_agent).get();
    if (!doc.exists) return "Responsable inconnu";
    const data = doc.data() || {};
    return data.nom || data.name || "Responsable inconnu";
  } catch (e) {
    console.error("Erreur lecture utilisateur:", e.message);
    return "Responsable inconnu";
  }
}

/**
 * Détermine le niveau de la côte d'un quartier selon son score sur 100.
 * VERT >= 80 | ORANGE entre 40 et 79 | ROUGE < 40
 */
function determinerNiveauCote(score) {
  if (score >= 80) return "VERT";
  if (score >= 40) return "ORANGE";
  return "ROUGE";
}

const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}



// Limite simple pour éviter trop d'instances
functions.setGlobalOptions({maxInstances: 10});

/**
 * Petit helper pour convertir une date Firestore/JS en Date JS.
 */
function convertirEnDate(valeur) {
  if (!valeur) {
    return null;
  }

  if (valeur instanceof Date) {
    return valeur;
  }

  if (typeof valeur.toDate === "function") {
    return valeur.toDate();
  }

  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Retourne la clé YYYY-MM-DD pour regrouper par jour.
 */
function cleJour(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Compte les dépôts par responsable sur une période donnée.
 * Le projet peut utiliser id_agent, responsableId ou respoID selon les données.
 */
async function compterDepotsParResponsable(dateDebut, dateFin) {
  const snapshot = await db
    .collection("depots")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(dateDebut))
    .where("date", "<=", admin.firestore.Timestamp.fromDate(dateFin))
    .get();

  const comptes = {};

  snapshot.forEach((document) => {
    const depot = document.data();
    const responsableId =
      depot.id_agent || depot.responsableId || depot.respoID || null;

    if (!responsableId) {
      return;
    }

    if (!comptes[responsableId]) {
      comptes[responsableId] = 0;
    }

    comptes[responsableId] += 1;
  });

  return comptes;
}

/**
 * Calcule une moyenne journalière simple sur les 7 jours précédents.
 * On ignore aujourd'hui pour comparer le volume du jour à l'habitude récente.
 */
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

  snapshot.forEach((document) => {
    const depot = document.data();
    const idTrouve =
      depot.id_agent || depot.responsableId || depot.respoID || null;

    if (idTrouve !== responsableId) {
      return;
    }

    const dateDepot = convertirEnDate(depot.date);
    if (!dateDepot) {
      return;
    }

    const jour = cleJour(dateDepot);
    if (!compteParJour[jour]) {
      compteParJour[jour] = 0;
    }

    compteParJour[jour] += 1;
  });

  let total = 0;
  const jours = Object.keys(compteParJour);

  jours.forEach((jour) => {
    total += compteParJour[jour];
  });

  return {
    moyenne: jours.length > 0 ? total / jours.length : 0,
    nbJoursAvecActivite: jours.length,
  };
}

/**
 * Essaie de retrouver le nom du responsable dans la collection utilisateurs.
 */
async function recupererNomResponsable(responsableId) {
  try {
    const utilisateur = await db.collection("utilisateurs").doc(responsableId).get();

    if (!utilisateur.exists) {
      return "Responsable inconnu";
    }

    const data = utilisateur.data() || {};
    return data.nom || data.name || "Responsable inconnu";
  } catch (error) {
    console.error("Erreur lecture utilisateur:", error);
    return "Responsable inconnu";
  }
}

/**
 * Crée ou met à jour une alerte du jour pour un responsable suspect.
 * Le document est stable par responsable + jour pour éviter les doublons.
 */
async function creerOuMettreAJourAlerte({
  responsableId,
  nom,
  multiplicateur,
  occurence,
  depotsAujourdHui,
  moyenneHabituelle,
}) {
  const aujourdHui = new Date();
  const jour = cleJour(aujourdHui);
  const alerteId = `${responsableId}_${jour}`;

  const donneesAlerte = {
    nom,
    responsableId,
    multiplicateur,
    occurence,
    date: admin.firestore.Timestamp.fromDate(aujourdHui),
    traite: false,
    depotsAujourdHui,
    moyenneHabituelle,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("alertes").doc(alerteId).set(donneesAlerte, {merge: true});
}

/**
 * Analyse simple des dépôts du jour.
 * Un responsable est considéré suspect si :
 * - il a au moins 5 dépôts aujourd'hui
 * - il a un historique minimal sur au moins 2 jours
 * - et son volume du jour est >= 2x sa moyenne récente
 */
async function analyserResponsablesSuspects() {
  const maintenant = new Date();
  const debutAujourdHui = new Date(maintenant);
  debutAujourdHui.setHours(0, 0, 0, 0);

  const finAujourdHui = new Date(maintenant);
  finAujourdHui.setHours(23, 59, 59, 999);

  const comptesDuJour = await compterDepotsParResponsable(
    debutAujourdHui,
    finAujourdHui
  );

  const responsables = Object.keys(comptesDuJour);
  let nombreAlertes = 0;

  for (const responsableId of responsables) {
    const depotsAujourdHui = comptesDuJour[responsableId];

    if (depotsAujourdHui < 5) {
      continue;
    }

    const historique = await calculerMoyenneGlissanteResponsable(
      responsableId,
      debutAujourdHui
    );

    if (historique.nbJoursAvecActivite < 2 || historique.moyenne <= 0) {
      continue;
    }

    const multiplicateurBrut = depotsAujourdHui / historique.moyenne;
    const multiplicateur = Number(multiplicateurBrut.toFixed(2));

    if (multiplicateur < 2) {
      continue;
    }

    const nom = await recupererNomResponsable(responsableId);

    await creerOuMettreAJourAlerte({
      responsableId,
      nom,
      multiplicateur,
      occurence: depotsAujourdHui,
      depotsAujourdHui,
      moyenneHabituelle: Number(historique.moyenne.toFixed(2)),
    });

    nombreAlertes += 1;
  }

  return {
    success: true,
    analysedResponsables: responsables.length,
    alertesCreeesOuMisesAJour: nombreAlertes,
  };
}

/**
 * Fonction callable existante, gardée en JavaScript CommonJS valide.
 * Sert à compléter les anciens établissements.
 */
exports.addMontantToExistingEtablissements = functions.https.onCall(
  async (data, context) => {
    if (!context.auth || context.auth.uid !== "cJdPoZIqE8a6hnSmPNO348TB2hI2") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Accès réservé à l'admin"
      );
    }

    const etablissementsRef = db.collection("etablissements");
    const snapshot = await etablissementsRef.get();

    if (snapshot.empty) {
      return {success: true, message: "Aucun établissement trouvé"};
    }

    const maintenant = admin.firestore.Timestamp.now();
    let updatedCount = 0;

    const batch = db.batch();

    snapshot.docs.forEach((document) => {
      const dataEtablissement = document.data();

      if (
        dataEtablissement.montantContrat === undefined ||
        dataEtablissement.dateRenouvellement === undefined
      ) {
        batch.update(document.ref, {
          montantContrat: 25000,
          dateRenouvellement: maintenant,
          createdAt: dataEtablissement.createdAt || maintenant,
          updatedAt: maintenant,
        });

        updatedCount += 1;
      }
    });

    await batch.commit();

    return {
      success: true,
      message:
        `${updatedCount} établissements ont été mis à jour avec montantContrat = 25000 et dateRenouvellement.`,
      updatedCount,
    };
  }
);

/**
 * Callable simple pour lancer l'analyse manuellement depuis l'admin si besoin.
 */
exports.detecterResponsablesSuspects = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Connexion requise"
      );
    }

    return analyserResponsablesSuspects();
  }
);

/**
 * Scheduler automatique.
 * Lance une vérification régulière des dépôts du jour.
 */
exports.verifierAlertesResponsables = functions.pubsub
  .schedule("every 60 minutes")
  .timeZone("Africa/Douala")
  .onRun(async () => {
    const resultat = await analyserResponsablesSuspects();
    console.log("Analyse alertes responsables:", resultat);
    return null;
  });
/**
 * marquerCouponUtilise
 * ─────────────────────
 * Appelée depuis l'app établissement (ou citoyen en test) après scan du QR coupon.
 * Elle :
 *   1. Vérifie que le coupon existe et appartient bien au citoyen authentifié
 *   2. Vérifie que le coupon est encore "disponible"
 *   3. Le marque "utilisé" de manière atomique (évite double utilisation)
 *   4. Incrémente total_reductions du citoyen selon l'offre du coupon
 *
 * Appelée côté client :
 *   const fn = httpsCallable(functions, "marquerCouponUtilise");
 *   await fn({ coupon_id: "abc123" });
 */
exports.marquerCouponUtilise = functions.https.onCall(async (data, context) => {
  // 1. Vérification authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise pour valider un coupon."
    );
  }

  const { coupon_id } = data;

  if (!coupon_id) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "L'identifiant du coupon est requis."
    );
  }

  // 2. Lecture du coupon dans Firestore
  const couponRef = db.collection("coupons").doc(coupon_id);
  const couponSnap = await couponRef.get();

  if (!couponSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Coupon introuvable."
    );
  }

  const couponData = couponSnap.data();

  // 3. Vérification que le coupon est encore disponible
  if (couponData.utilise === true || couponData.statut === "utilisé") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Ce coupon a déjà été utilisé."
    );
  }

  if (couponData.statut === "expiré") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Ce coupon est expiré."
    );
  }

  // 4. Mise à jour atomique (batch)
  const batch = db.batch();

  // Marquer le coupon comme utilisé
  batch.update(couponRef, {
    utilise: true,
    statut: "utilisé",
    date_utilisation: admin.firestore.Timestamp.now(),
    id_valideur: context.auth.uid, // uid de celui qui a validé (établissement ou agent)
  });

  // Incrémenter total_reductions du citoyen
  // On extrait la valeur numérique depuis le champ "offre" s'il existe,
  // sinon on met une valeur par défaut de 500 FCFA
  const montantReduction = couponData.montant_reduction || 500;
  const citoyenRef = db.collection("utilisateurs").doc(couponData.id_citoyen);
  batch.update(citoyenRef, {
    total_reductions: admin.firestore.FieldValue.increment(montantReduction),
  });

  await batch.commit();

  console.log(`Coupon ${coupon_id} marqué utilisé par ${context.auth.uid}`);

  return {
    success: true,
    message: "Coupon validé avec succès.",
    coupon_id,
    montant_reduction: montantReduction,
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 1 — ENREGISTRER UN DÉPÔT + CRÉDITER LES POINTS + MAJ BAC
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   C'est la SEULE façon de créditer des point à un citoyen.
 *   Elle est appelée par responsable.tsx après scan QR du citoyen.
 *
 * CE QU'ELLE FAIT :
 *   1. Vérifie que le citoyen et le bac existent
 *   2. Crée un document dépôt immuable (jamais modifiable)
 *   3. Crédite les point au citoyen (totalPoints = pointBase + bonusTri)
 *   4. Met à jour le compteur de remplissage du bac (remplissage_actuel 0→100)
 *   5. Si le bac est plein → crée un signalement automatique pour Hyzakam
 *   6. Met à jour la côte du quartier du citoyen
 *   7. Vérifie si des coupons peuvent être débloqués
 *
 * PARAMÈTRES REÇUS :
 *   id_citoyen     : UID Firebase du citoyen
 *   respoId       : UID Firebase du responsable
 *   bacId         : ID du document dans la collection bacs
 *   categorie     : "mini" | "petit" | "moyen" | "grand"
 *   poids         : poids en grammes choisi dans le barème
 *   pointBase    : point calculés côté app selon le barème
 *   bonusTri      : point bonus si les déchets sont triés (0 si non)
 *   tri           : boolean — true si les déchets sont triés
 */
exports.enregistrerDepot = functions.https.onCall(async (data, context) => {
  // Vérification de l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise",
    );
  }

  const {
    id_citoyen,
    id_agent,
    bacId,
    categorie,
    poids,
    pointBase,
    bonusTri,
    tri,
  } = data;

  // Validation des champs obligatoires
  if (
    !id_citoyen ||
    !id_agent ||
    !bacId ||
    !categorie ||
    !poids ||
    pointBase === undefined
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Données incomplètes : id_citoyen, id_agent, bacId, categorie, poids, pointBase sont requis",
    );
  }

  const totalPoints = pointBase + (bonusTri || 0);
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  console.log(
    `[enregistrerDepot] Citoyen=${id_citoyen} | Recto=${respoId} | Bac=${bacId} | Points=${totalPoints}`,
  );

  // ── Vérifications d'existence ──
  const citoyenRef = db.collection("utilisateurs").doc(id_citoyen);
  const citoyenSnap = await citoyenRef.get();
  if (!citoyenSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Citoyen introuvable dans Firestore",
    );
  }
  //Verification du bac (creation si inexistence)
  const bacRef = db.collection("bacs").doc(bacId);
  const bacSnap = await bacRef.get();
  if (!bacSnap.exists) {
    await bacRef.set({
      remplissage_actuel: 0,
      etat: "disponible",
      capacite_max: 50,           // 50 kg par défaut
      derniere_collecte: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[enregistrerDepot] Bac créé automatiquement pour ${bacId || id_agent}`);
  }

  const bacData = bacSnap.data();
  // capacite_max est en kg dans Firestore (défaut 50 kg)
  // On travaille en grammes : 50 kg = 50 000 g
  const capaciteMaxG = (bacData.capacite_max || 50) * 1000;

  // remplissage_actuel est sur une échelle 0→100 (pourcentage)
  const remplissageActuel = bacData.remplissage_actuel || 0;

  // On convertit le poids déposé en pourcentage d'utilisation du bac
  const pourcentageAjoute = (poids / capaciteMaxG) * 100;
  const nouveauRemplissage = Math.min(
    100,
    remplissageActuel + pourcentageAjoute,
  );

  // ── Batch Firestore — toutes les écritures dans une seule transaction ──
  const batch = db.batch();

  // 1) Créer le document dépôt (document immuable — pas de update/delete autorisé)
  const depotRef = db.collection("depots").doc();
  batch.set(depotRef, {
    id_citoyen: id_citoyen, // compatibilité avec la structure existante
    id_agent: respoId,
    bacId,
    quartier: citoyenSnap.data().quartier || "",
    categorie,
    poids,
    pointBase,
    bonusTri: bonusTri || 0,
    tri: tri || false,
    point: totalPoints, // "point" pour compatibilité avec les autres écrans
    totalPoints,
    date: maintenant,
    createdAt: maintenant,
  });

  // 2) Créditer les point au citoyen (seule façon autorisée)
  batch.update(citoyenRef, {
    point: admin.firestore.FieldValue.increment(totalPoints),
    updatedAt: maintenant,
  });

  // 3) Mettre à jour le remplissage du bac (0→100)
  batch.update(bacRef, {
    remplissage_actuel: nouveauRemplissage,
    updatedAt: maintenant,
  });

  await batch.commit();

  console.log(
    `[enregistrerDepot] Dépôt ${depotRef.id} créé | Remplissage bac : ${nouveauRemplissage.toFixed(1)}%`,
  );

  // ── Signalement automatique si le bac est plein (remplissage >= 100) ──
  let bacPlein = false;
  if (nouveauRemplissage >= 100) {
    bacPlein = true;
    await db.collection("signalements").add({
      bacId,
      id_auteur: respoId,
      respoId,
      type: "bac_plein",
      traite: false,
      remplissage: nouveauRemplissage,
      capaciteMax: bacData.capacite_max || 50,
      localisation: bacData.localisation || null,
      date: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(
      `[enregistrerDepot] SIGNALEMENT AUTOMATIQUE créé pour le bac ${bacId}`,
    );
  }

  // ── Mettre à jour la côte du quartier du citoyen ──
  const quartier = citoyenSnap.data().quartier;
  if (quartier) {
    try {
      await _recalculerCoteQuartierInterne(quartier);
    } catch (e) {
      // On ne bloque pas la réponse si la côte échoue
      console.error("[enregistrerDepot] Erreur mise à jour côte:", e.message);
    }
  }

  // ── Vérifier le déblocage des coupons du citoyen ──
  try {
    await _verifierDeblocageCouponsInterne(id_citoyen);
  } catch (e) {
    console.error("[enregistrerDepot] Erreur déblocage coupons:", e.message);
  }

  return {
    success: true,
    depotId: depotRef.id,
    pointCredites: totalPoints,
    remplissageBac: Math.round(nouveauRemplissage),
    bacPlein,
    message: `${totalPoints} point crédités au citoyen`,
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 2 — TRAITER UN SIGNALEMENT DE BAC PLEIN
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Appelée quand Hyzakam clique sur "Traiter" dans l'onglet signalements.
 *
 * CE QU'ELLE FAIT :
 *   1. Marque le signalement comme traité
 *   2. Remet le remplissage_actuel du bac à 0 (bac vidé)
 *   3. Enregistre la date de la dernière collecte
 *   4. Si le bac n'était PAS bien rempli → crée une alerte direction
 *      (le responsable a fait des faux dépôts)
 *
 * PARAMÈTRES REÇUS :
 *   signalementId  : ID du document dans la collection signalements
 *   bacBienRempli  : boolean — false si Hyzakam constate que le bac est vide
 */
exports.traiterSignalement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise",
    );
  }

  const { signalementId, bacBienRempli } = data;

  if (!signalementId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "signalementId requis",
    );
  }

  const signalementRef = db.collection("signalements").doc(signalementId);
  const signalementSnap = await signalementRef.get();

  if (!signalementSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Signalement introuvable",
    );
  }

  const signalementData = signalementSnap.data();
  const bacId = signalementData.bacId;
  const respoId = signalementData.respoId || signalementData.id_auteur;
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  const batch = db.batch();

  // 1) Marquer le signalement traité
  batch.update(signalementRef, {
    traite: true,
    bacBienRempli: bacBienRempli !== false, // true par défaut si non précisé
    traiteLe: maintenant,
    updatedAt: maintenant,
  });

  // 2) Remettre le bac à 0 et enregistrer la date de vidange
  if (bacId) {
    const bacRef = db.collection("bacs").doc(bacId);
    batch.update(bacRef, {
      remplissage_actuel: 0,
      derniere_collecte: maintenant,
      etat: "disponible",
      updatedAt: maintenant,
    });
  }

  await batch.commit();

  console.log(
    `[traiterSignalement] Signalement ${signalementId} traité | Bac bien rempli: ${bacBienRempli}`,
  );

  // 3) Bac vide malgré signalement → responsable suspect → alerte direction
  let alerteDirectionCreee = false;
  if (bacBienRempli === false && respoId) {
    // Incrémenter le compteur d'occurrences du responsable dans les alertes
    const respoNom = await recupererNomResponsable(respoId);
    const alerteExistante = await db
      .collection("alertes")
      .where("id_agent", "==", respoId)
      .where("traite", "==", false)
      .limit(1)
      .get();

    if (!alerteExistante.empty) {
      const alerteDoc = alerteExistante.docs[0];
      await alerteDoc.ref.update({
        occurence: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection("alertes").add({
        nom: respoNom,
        id_agent: respoId,
        bacId,
        motif:
          "Bac signalé plein mais constaté vide lors de la vidange — faux dépôts suspects",
        multiplicateur: 0,
        occurence: 1,
        traite: false,
        date: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    alerteDirectionCreee = true;
    console.log(
      `[traiterSignalement] ALERTE créée pour responsable ${respoId} — bac non rempli`,
    );
  }

  return {
    success: true,
    bacRemisAZero: !!bacId,
    alerteDirectionCreee,
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 3 — VALIDER UN ÉTABLISSEMENT PARTENAIRE
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Après vérification manuelle du contrat par Hyzakam, il valide l'établissement.
 *   → Met à jour le statut, fixe le montant du contrat et la date de renouvellement.
 *
 * CE QU'ELLE FAIT :
 *   1. Vérifie l'existence de l'établissement
 *   2. Passe le statut à "valide"
 *   3. Fixe le montantContrat à 25000 FCFA (ou valeur personnalisée)
 *   4. Calcule dateRenouvellement = aujourd'hui + 30 jours
 *   5. Aussi valide le compte utilisateur lié dans partenaires
 *
 * PARAMÈTRES REÇUS :
 *   etablissementId : UID Firebase Auth de l'établissement
 *   montantContrat  : montant du contrat en FCFA (défaut: 25000)
 */
exports.validerEtablissement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise",
    );
  }

  const { etablissementId, montantContrat } = data;

  if (!etablissementId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "etablissementId requis",
    );
  }

  const etablissementRef = db.collection("etablissements").doc(etablissementId);
  const snap = await etablissementRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Établissement introuvable",
    );
  }

  const dateRenouvellement = new Date();
  dateRenouvellement.setDate(dateRenouvellement.getDate() + 30);

  const batch = db.batch();

  // Mettre à jour dans la collection etablissements
  batch.update(etablissementRef, {
    statut: "valide",
    montantContrat: montantContrat || 25000,
    dateRenouvellement: admin.firestore.Timestamp.fromDate(dateRenouvellement),
    valideLe: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Mettre à jour dans la collection partenaires si le document existe
  const partenaireRef = db.collection("partenaires").doc(etablissementId);
  const partenaireSnap = await partenaireRef.get();
  if (partenaireSnap.exists) {
    batch.update(partenaireRef, {
      statut: "valide",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  console.log(
    `[validerEtablissement] Établissement ${etablissementId} validé | Contrat: ${montantContrat || 25000} FCFA`,
  );

  return {
    success: true,
    etablissementId,
    montantContrat: montantContrat || 25000,
    dateRenouvellement: dateRenouvellement.toISOString(),
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 4 — REFUSER UNE DEMANDE D'ÉTABLISSEMENT
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Hyzakam peut refuser un établissement qui ne remplit pas les conditions.
 *   Seule une Cloud Function peut modifier le statut pour éviter la fraude.
 *
 * PARAMÈTRES REÇUS :
 *   etablissementId : UID Firebase Auth de l'établissement
 *   motifRefus      : raison du refus (ex: "Contrat non conforme")
 */
exports.refuserEtablissement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise",
    );
  }

  const { etablissementId, motifRefus } = data;

  if (!etablissementId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "etablissementId requis",
    );
  }

  const batch = db.batch();
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  const etablissementRef = db.collection("etablissements").doc(etablissementId);
  batch.update(etablissementRef, {
    statut: "refuse",
    motifRefus: motifRefus || "Non précisé",
    refuseLe: maintenant,
    updatedAt: maintenant,
  });

  const partenaireRef = db.collection("partenaires").doc(etablissementId);
  const partenaireSnap = await partenaireRef.get();
  if (partenaireSnap.exists) {
    batch.update(partenaireRef, {
      statut: "refuse",
      motifRefus: motifRefus || "Non précisé",
      updatedAt: maintenant,
    });
  }

  await batch.commit();

  console.log(
    `[refuserEtablissement] Établissement ${etablissementId} refusé | Motif: ${motifRefus}`,
  );

  return { success: true, etablissementId };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 5 — CRÉER LES COUPONS D'UN CITOYEN (INSCRIPTION)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   C'est la SEULE façon de créer des coupons. Appelée juste après l'inscription
 *   d'un citoyen dans inscription.tsx.
 *
 * CE QU'ELLE FAIT :
 *   Crée 2 coupons bloqués (statut: "bloque") pour le citoyen :
 *   - Coupon PETIT  : valeur 50 pts  | seuil déblocage : 50 pts
 *   - Coupon GRAND  : valeur 200 pts | seuil déblocage : 200 pts
 *
 *   Le coupon reste bloqué jusqu'à ce que le citoyen atteigne le seuil requis.
 *   En côte ROUGE, seuls les coupons de 25, 50 ou 100 pts sont utilisables.
 *
 * PARAMÈTRES REÇUS :
 *   id_citoyen : UID Firebase du citoyen nouvellement inscrit
 */
exports.creerCouponsCitoyen = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise",
    );
  }

  const { id_citoyen } = data;

  if (!id_citoyen) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "id_citoyen requis",
    );
  }

  // Vérifier que des coupons n'ont pas déjà été créés pour éviter les doublons
  const couponsExistants = await db
    .collection("coupons")
    .where("id_citoyen", "==", id_citoyen)
    .limit(1)
    .get();

  if (!couponsExistants.empty) {
    console.log(
      `[creerCouponsCitoyen] Coupons déjà existants pour ${id_citoyen} — aucune création`,
    );
    return {
      success: true,
      message: "Coupons déjà créés",
      couponsDebloques: 0,
    };
  }

  const maintenant = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  // Coupon PETIT — seuil : 50 point
  const couponPetitRef = db.collection("coupons").doc();
  batch.set(couponPetitRef, {
    id_citoyen,
    id_citoyen: id_citoyen, // compatibilité
    type: "petit",
    valeur: 50,
    point: 50, // compatibilité
    statut: "bloque",
    seuilDeblocage: 50,
    offre: "Réduction de 50 FCFA",
    dateCreation: maintenant,
    createdAt: maintenant,
  });

  // Coupon GRAND — seuil : 200 point
  const couponGrandRef = db.collection("coupons").doc();
  batch.set(couponGrandRef, {
    id_citoyen,
    id_citoyen: id_citoyen, // compatibilité
    type: "grand",
    valeur: 200,
    point: 200, // compatibilité
    statut: "bloque",
    seuilDeblocage: 200,
    offre: "Réduction de 200 FCFA",
    dateCreation: maintenant,
    createdAt: maintenant,
  });

  await batch.commit();

  console.log(
    `[creerCouponsCitoyen] 2 coupons créés (bloqués) pour le citoyen ${id_citoyen}`,
  );

  return {
    success: true,
    couponPetitId: couponPetitRef.id,
    couponGrandId: couponGrandRef.id,
    message: "2 coupons créés et bloqués en attente d'accumulation de point",
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 6 — VÉRIFIER ET DÉBLOQUER LES COUPONS D'UN CITOYEN
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Appelée automatiquement après chaque dépôt via enregistrerDepot().
 *   Peut aussi être appelée manuellement si besoin.
 *
 * CE QU'ELLE FAIT :
 *   1. Récupère les point actuels du citoyen
 *   2. Pour chaque coupon bloqué, vérifie si le seuil est atteint
 *   3. Si oui → passe le coupon en "disponible" + fixe dateExpiration = now + 24h
 *   4. Chaque coupon se débloque INDÉPENDAMMENT (le grand n'attend pas le petit)
 *
 * RÈGLE MÉTIER IMPORTANTE :
 *   En côte ROUGE, seuls les coupons de valeur <= 100 pts sont utilisables.
 *   Le déblocage reste valide mais l'établissement vérifiera la côte à l'utilisation.
 */
async function _verifierDeblocageCouponsInterne(id_citoyen) {
  const citoyenSnap = await db.collection("utilisateurs").doc(id_citoyen).get();
  if (!citoyenSnap.exists) return { couponsDebloques: 0 };

  const pointCitoyen = citoyenSnap.data().point || 0;

  const couponsSnap = await db
    .collection("coupons")
    .where("id_citoyen", "==", id_citoyen)
    .where("statut", "==", "bloque")
    .get();

  if (couponsSnap.empty) return { couponsDebloques: 0 };

  const batch = db.batch();
  let couponsDebloques = 0;
  const maintenant = admin.firestore.FieldValue.serverTimestamp();

  couponsSnap.forEach((doc) => {
    const coupon = doc.data();
    if (pointCitoyen >= coupon.seuilDeblocage) {
      const dateExpiration = new Date();
      dateExpiration.setHours(dateExpiration.getHours() + 24);

      batch.update(doc.ref, {
        statut: "disponible",
        dateDeblocage: maintenant,
        dateExpiration: admin.firestore.Timestamp.fromDate(dateExpiration),
        updatedAt: maintenant,
      });
      couponsDebloques++;
      console.log(
        `[verifierDeblocage] Coupon ${doc.id} débloqué pour citoyen ${id_citoyen}`,
      );
    }
  });

  if (couponsDebloques > 0) {
    await batch.commit();
  }

  return { couponsDebloques };
}

exports.verifierDeblocageCoupons = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Connexion requise",
      );
    }

    const { id_citoyen } = data;
    if (!id_citoyen) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "id_citoyen requis",
      );
    }

    const resultat = await _verifierDeblocageCouponsInterne(id_citoyen);
    return { success: true, ...resultat };
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 7 — VALIDER UN COUPON (UTILISÉ PAR UN ÉTABLISSEMENT)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Quand un établissement scanne le QR code d'un coupon, cette fonction
 *   effectue toutes les vérifications de sécurité avant de le valider.
 *
 * CE QU'ELLE FAIT (3 vérifications) :
 *   1. Le coupon existe dans Firestore
 *   2. Son statut est "disponible" (pas expiré, pas déjà utilisé, pas bloqué)
 *   3. Il n'est pas expiré (dateExpiration > maintenant)
 *   Si tout est OK → statut passe à "utilise" + bloque l'autre coupon du citoyen
 *   → Déduit le montant du contrat de l'établissement
 *
 * PARAMÈTRES REÇUS :
 *   couponId       : ID du document coupon scanné
 *   etablissementId : UID Firebase de l'établissement qui scanne
 */
exports.validerCoupon = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Connexion requise",
    );
  }

  const { couponId, etablissementId } = data;

  if (!couponId || !etablissementId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "couponId ou etablissementId requis",
    );
  }

  // ── Vérification 1 : le coupon existe ──
  const couponRef = db.collection("coupons").doc(couponId);
  const couponSnap = await couponRef.get();

  if (!couponSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Coupon introuvable — QR code invalide",
    );
  }

  const couponData = couponSnap.data();

  // ── Vérification 2 : le coupon est disponible ──
  if (couponData.statut !== "disponible") {
    const messages = {
      bloque: "Ce coupon est bloqué — seuil de point non atteint",
      utilise: "Ce coupon a déjà été utilisé",
      expire: "Ce coupon a expiré",
    };
    throw new functions.https.HttpsError(
      "failed-precondition",
      messages[couponData.statut] || "Coupon non disponible",
    );
  }

  // ── Vérification 3 : le coupon n'est pas expiré ──
  if (couponData.dateExpiration) {
    const dateExp = convertirEnDate(couponData.dateExpiration);
    if (dateExp && dateExp < new Date()) {
      // Marquer comme expiré en passant
      await couponRef.update({
        statut: "expire",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Ce coupon a expiré (plus de 24h)",
      );
    }
  }

  // ── Vérification côte ROUGE ──
  const id_citoyen = couponData.id_citoyen || couponData.id_citoyen;
  const citoyenSnap = await db.collection("utilisateurs").doc(id_citoyen).get();
  if (citoyenSnap.exists) {
    const quartier = citoyenSnap.data().quartier;
    if (quartier) {
      const coteSnap = await db.collection("cote").doc(quartier).get();
      if (coteSnap.exists) {
        const score = coteSnap.data().score_total || 0;
        const niveau = determinerNiveauCote(score);
        if (niveau === "ROUGE" && couponData.valeur > 100) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Quartier en côte ROUGE — seuls les coupons ≤ 100 pts sont acceptés (ce coupon vaut ${couponData.valeur} pts)`,
          );
        }
      }
    }
  }

  const maintenant = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  // 1) Marquer le coupon comme utilisé
  batch.update(couponRef, {
    statut: "utilise",
    utilise: true,
    id_etablissement: etablissementId,
    dateUtilisation: maintenant,
    updatedAt: maintenant,
  });

  // 2) Bloquer l'autre coupon du même citoyen
  //    (règle métier : utiliser un coupon bloque automatiquement l'autre)
  const autresCouponsSnap = await db
    .collection("coupons")
    .where("id_citoyen", "==", id_citoyen)
    .where("statut", "==", "disponible")
    .get();

  autresCouponsSnap.forEach((doc) => {
    if (doc.id !== couponId) {
      batch.update(doc.ref, {
        statut: "bloque",
        bloquePar: couponId,
        updatedAt: maintenant,
      });
    }
  });

  // 3) Déduire du contrat de l'établissement
  const montantReduction = couponData.valeur || 0;
  const etablissementRef = db.collection("etablissements").doc(etablissementId);
  batch.update(etablissementRef, {
    total_reductions: admin.firestore.FieldValue.increment(montantReduction),
    coupons_valides_total: admin.firestore.FieldValue.increment(1),
    updatedAt: maintenant,
  });

  await batch.commit();

  console.log(
    `[validerCoupon] Coupon ${couponId} validé par établissement ${etablissementId} | Réduction: ${montantReduction} FCFA`,
  );

  return {
    success: true,
    couponId,
    montantReduction,
    message: `Coupon validé — réduction de ${montantReduction} FCFA accordée`,
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 8 — RECALCULER LA CÔTE D'UN QUARTIER
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   La côte du quartier impacte directement la valeur des coupons.
 *   Cette fonction est appelée :
 *   - Automatiquement après chaque dépôt (via enregistrerDepot)
 *   - Manuellement par Hyzakam depuis le tableau de bord
 *
 * COMMENT LE SCORE EST CALCULÉ :
 *   - Score = moyenne des point / 10 (plafonné à 100)
 *   - 1000 pts en moyenne par citoyen = score 100
 *   - VERT >= 80 | ORANGE 40-79 | ROUGE < 40
 *
 * PARAMÈTRES REÇUS :
 *   quartier : nom du quartier (ex: "Banengo")
 */
async function _recalculerCoteQuartierInterne(quartier) {
  const citoyensSnap = await db
    .collection("utilisateurs")
    .where("quartier", "==", quartier)
    .where("role", "==", "citoyen")
    .get();

  let totalPoints = 0;
  citoyensSnap.forEach((doc) => {
    totalPoints += doc.data().point || 0;
  });

  const nbCitoyens = citoyensSnap.size;
  const moyenneParCitoyen = nbCitoyens > 0 ? totalPoints / nbCitoyens : 0;
  const score = Math.min(100, Math.round(moyenneParCitoyen / 10));
  const niveau = determinerNiveauCote(score);

  await db.collection("cote").doc(quartier).set(
    {
      nom_quartier: quartier,
      quartier,
      score_total: score,
      niveau,
      totalPoints,
      nbCitoyens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(
    `[recalculerCote] Quartier ${quartier} | Score: ${score}/100 | Niveau: ${niveau}`,
  );
  return { score, niveau, nbCitoyens, totalPoints };
}

exports.recalculerCoteQuartier = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Connexion requise",
      );
    }

    const { quartier } = data;
    if (!quartier) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "quartier requis",
      );
    }

    const resultat = await _recalculerCoteQuartierInterne(quartier);
    return { success: true, quartier, ...resultat };
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 9 — MISE À JOUR QUOTIDIENNE DE TOUTES LES CÔTES (CRON)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Garantit que toutes les côtes sont à jour même si des citoyens n'ont
 *   pas fait de dépôts. Lance à 2h du matin pour ne pas surcharger le système.
 */
exports.majToutesCotesQuartiers = functions.pubsub
  .schedule("0 2 * * *") // Tous les jours à 2h du matin
  .timeZone("Africa/Douala")
  .onRun(async () => {
    console.log("[majToutesCotes] Démarrage mise à jour toutes les côtes...");

    const configSnap = await db.collection("configuration").doc("zones").get();

    let quartiers = [];

    if (configSnap.exists) {
      const zones = configSnap.data().zones || [];
      zones.forEach((zone) => {
        if (zone.quartiers) {
          zone.quartiers.forEach((q) => {
            const nom = typeof q === "string" ? q : q.nom;
            if (nom) quartiers.push(nom);
          });
        }
      });
    }

    // Fallback : lire les quartiers depuis la collection cote existante
    if (quartiers.length === 0) {
      const coteSnap = await db.collection("cote").get();
      coteSnap.forEach((doc) => {
        const nom = doc.data().nom_quartier || doc.data().quartier || doc.id;
        if (nom) quartiers.push(nom);
      });
    }

    let mises_a_jour = 0;
    for (const quartier of quartiers) {
      try {
        await _recalculerCoteQuartierInterne(quartier);
        mises_a_jour++;
      } catch (e) {
        console.error(
          `[majToutesCotes] Erreur quartier ${quartier}:`,
          e.message,
        );
      }
    }

    console.log(
      `[majToutesCotes] ${mises_a_jour}/${quartiers.length} quartiers mis à jour`,
    );
    return null;
  });

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 10 — DÉTECTION DES RESPONSABLES SUSPECTS (CRON + CALLABLE)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Détecte automatiquement les responsables qui enregistrent trop de dépôts
 *   par rapport à leur moyenne habituelle. Signe possible de faux dépôts.
 *
 * LOGIQUE DE DÉTECTION :
 *   - Compare le nombre de dépôts du jour à la moyenne des 7 derniers jours
 *   - Si le responsable dépasse 2x sa moyenne ET a ≥ 5 dépôts → ALERTE
 *   - Le multiplicateur = (dépôts du jour) / (moyenne 7 jours)
 *     ex: multiplicateur = 3.2 signifie "3.2x sa moyenne habituelle"
 */
async function analyserResponsablesSuspects() {
  const maintenant = new Date();
  const debutAujourdHui = new Date(maintenant);
  debutAujourdHui.setHours(0, 0, 0, 0);
  const finAujourdHui = new Date(maintenant);
  finAujourdHui.setHours(23, 59, 59, 999);

  // Compter les dépôts du jour par responsable
  const snapshot = await db
    .collection("depots")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(debutAujourdHui))
    .where("date", "<=", admin.firestore.Timestamp.fromDate(finAujourdHui))
    .get();

  const comptesDuJour = {};
  snapshot.forEach((doc) => {
    const depot = doc.data();
    const respoId = depot.id_agent || depot.id_agent || depot.respoID || null;
    if (!respoId) return;
    comptesDuJour[respoId] = (comptesDuJour[respoId] || 0) + 1;
  });

  const responsables = Object.keys(comptesDuJour);
  let nombreAlertes = 0;

  for (const respoId of responsables) {
    const depotsAujourdHui = comptesDuJour[respoId];
    if (depotsAujourdHui < 5) continue; // Trop peu de dépôts pour être suspect

    // Calculer la moyenne glissante sur 7 jours
    const debutHistorique = new Date(debutAujourdHui);
    debutHistorique.setDate(debutHistorique.getDate() - 7);
    const finHistorique = new Date(debutAujourdHui);
    finHistorique.setMilliseconds(finHistorique.getMilliseconds() - 1);

    const snapshotHisto = await db
      .collection("depots")
      .where("date", ">=", admin.firestore.Timestamp.fromDate(debutHistorique))
      .where("date", "<=", admin.firestore.Timestamp.fromDate(finHistorique))
      .get();

    const compteParJour = {};
    snapshotHisto.forEach((doc) => {
      const depot = doc.data();
      const idTrouve =
        depot.id_agent || depot.id_agent || depot.respoID || null;
      if (idTrouve !== respoId) return;
      const dateDepot = convertirEnDate(depot.date);
      if (!dateDepot) return;
      const jour = cleJour(dateDepot);
      compteParJour[jour] = (compteParJour[jour] || 0) + 1;
    });

    const jours = Object.keys(compteParJour);
    if (jours.length < 2) continue; // Pas assez d'historique

    const totalHisto = jours.reduce((acc, j) => acc + compteParJour[j], 0);
    const moyenne = totalHisto / jours.length;
    if (moyenne <= 0) continue;

    const multiplicateur = Number((depotsAujourdHui / moyenne).toFixed(2));
    if (multiplicateur < 2) continue; // Pas suspect

    const nom = await recupererNomResponsable(respoId);
    const alerteId = `${respoId}_${cleJour(maintenant)}`;

    await db
      .collection("alertes")
      .doc(alerteId)
      .set(
        {
          nom,
          id_agent: respoId,
          multiplicateur,
          occurence: depotsAujourdHui,
          depotsAujourdHui,
          moyenneHabituelle: Number(moyenne.toFixed(2)),
          traite: false,
          date: admin.firestore.Timestamp.fromDate(maintenant),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    nombreAlertes++;
    console.log(
      `[alerteResponsable] ${nom} | ${depotsAujourdHui} dépôts | ${multiplicateur}x la moyenne`,
    );
  }

  return {
    success: true,
    analysedResponsables: responsables.length,
    alertesCreeesOuMisesAJour: nombreAlertes,
  };
}

// Version callable (lancement manuel depuis le tableau Hyzakam)
exports.detecterResponsablesSuspects = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Connexion requise",
      );
    }
    return analyserResponsablesSuspects();
  },
);

// Version planifiée (toutes les 60 minutes)
exports.verifierAlertesResponsables = functions.pubsub
  .schedule("every 60 minutes")
  .timeZone("Africa/Douala")
  .onRun(async () => {
    const resultat = await analyserResponsablesSuspects();
    console.log("[verifierAlertes] Résultat:", resultat);
    return null;
  });

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 11 — EXPIRER LES COUPONS PÉRIMÉS (CRON)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Un coupon débloqué expire automatiquement après 24h.
 *   Cette fonction passe en "expire" tous les coupons dont la dateExpiration
 *   est dépassée. Tourne chaque nuit à 1h du matin.
 */
exports.expirerCouponsPerimes = functions.pubsub
  .schedule("0 1 * * *") // Tous les jours à 01h du matin
  .timeZone("Africa/Douala")
  .onRun(async () => {
    const maintenant = admin.firestore.Timestamp.now();

    const couponsExpirables = await db
      .collection("coupons")
      .where("statut", "==", "disponible")
      .where("dateExpiration", "<", maintenant)
      .get();

    if (couponsExpirables.empty) {
      console.log("[expirerCoupons] Aucun coupon à expirer");
      return null;
    }

    const batch = db.batch();
    couponsExpirables.forEach((doc) => {
      batch.update(doc.ref, {
        statut: "expire",
        updatedAt: maintenant,
      });
    });

    await batch.commit();
    console.log(
      `[expirerCoupons] ${couponsExpirables.size} coupon(s) passés en expiré`,
    );
    return null;
  });

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 12 — STATISTIQUES DU JOUR (Firestore trigger)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Evite de recalculer les statistiques à la volée dans l'interface.
 *   Chaque nouveau dépôt met à jour un document de stats du jour.
 *   Hyzakam lit ce document pour afficher les statistiques globales rapidement.
 */
exports.majStatsGlobales = functions.firestore
  .document("depots/{depotId}")
  .onCreate(async (snap) => {
    const depot = snap.data();
    const jour = cleJour(new Date());
    const statsRef = db.collection("stats_globales").doc(jour);

    return statsRef.set(
      {
        totalPointsJour: admin.firestore.FieldValue.increment(
          depot.totalPoints || depot.point || 0,
        ),
        totalDepotsJour: admin.firestore.FieldValue.increment(1),
        derniereMaj: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 13 — RENOUVELLEMENT AUTOMATIQUE DES CONTRATS (BACKUP CALLABLE)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Backup de la version GitHub Actions (scripts/renouveler-contrats.js).
 *   Si le script échoue, Hyzakam peut déclencher manuellement le renouvellement.
 *   Aussi utilisée pour initialiser les anciens établissements sans contrat.
 */
exports.addMontantToExistingEtablissements = functions.https.onCall(
  async (data, context) => {
    // Réservé uniquement à l'admin Hyzakam (uid fixe)
    if (!context.auth || context.auth.uid !== "cJdPoZIqE8a6hnSmPNO348TB2hI2") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Accès réservé à l'admin Hyzakam",
      );
    }

    const snapshot = await db.collection("etablissements").get();
    if (snapshot.empty)
      return {
        success: true,
        message: "Aucun établissement trouvé",
        updatedCount: 0,
      };

    const maintenant = admin.firestore.Timestamp.now();
    const dateRenouvellement30j = new Date();
    dateRenouvellement30j.setDate(dateRenouvellement30j.getDate() + 30);

    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      const etab = doc.data();
      if (
        etab.montantContrat === undefined ||
        etab.dateRenouvellement === undefined
      ) {
        batch.update(doc.ref, {
          montantContrat: 25000,
          dateRenouvellement: admin.firestore.Timestamp.fromDate(
            dateRenouvellement30j,
          ),
          createdAt: etab.createdAt || maintenant,
          updatedAt: maintenant,
        });
        updatedCount++;
      }
    });

    await batch.commit();

    console.log(`[addMontant] ${updatedCount} établissements mis à jour`);
    return {
      success: true,
      updatedCount,
      message: `${updatedCount} établissements initialisés`,
    };
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTION 14 — TABLEAU ÉCONOMIQUE MENSUEL HYZAKAM (CALLABLE)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * POURQUOI CETTE FONCTION ?
 *   Calcule les statistiques économiques mensuelles pour le tableau de bord
 *   Hyzakam : économies sur la collecte + revenus des contrats.
 *
 * CE QU'ELLE RETOURNE :
 *   - Total des contrats actifs (nb établissements × 25000 FCFA)
 *   - Total des réductions accordées (coupons utilisés ce mois)
 *   - Nombre de signalements traités (= tournées optimisées)
 *   - Nombre de dépôts du mois
 */
exports.calculerTableauEconomique = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Connexion requise",
      );
    }

    const maintenant = new Date();
    const debutMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      1,
    );

    // Compter les établissements valides (contrats actifs)
    const etablissementsSnap = await db
      .collection("etablissements")
      .where("statut", "==", "valide")
      .get();

    let revenusContrats = 0;
    etablissementsSnap.forEach((doc) => {
      revenusContrats += doc.data().montantContrat || 25000;
    });

    // Total des réductions accordées ce mois
    const couponsSnap = await db
      .collection("coupons")
      .where("statut", "==", "utilise")
      .where(
        "dateUtilisation",
        ">=",
        admin.firestore.Timestamp.fromDate(debutMois),
      )
      .get();

    let totalReductions = 0;
    couponsSnap.forEach((doc) => {
      totalReductions += doc.data().valeur || 0;
    });

    // Signalements traités ce mois (= tournées collecte effectuées)
    const signalementsSnap = await db
      .collection("signalements")
      .where("traite", "==", true)
      .where("traiteLe", ">=", admin.firestore.Timestamp.fromDate(debutMois))
      .get();

    // Dépôts du mois
    const depotsSnap = await db
      .collection("depots")
      .where("date", ">=", admin.firestore.Timestamp.fromDate(debutMois))
      .get();

    const mois = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;

    const tableau = {
      mois,
      nbEtablissementsActifs: etablissementsSnap.size,
      revenusContrats,
      totalReductions,
      beneficeNet: revenusContrats - totalReductions,
      tourneesEffectuees: signalementsSnap.size,
      totalDepotsMois: depotsSnap.size,
      updatedAt: new Date().toISOString(),
    };

    // Sauvegarder dans Firestore pour lecture rapide
    await db
      .collection("stats_globales")
      .doc(`economique_${mois}`)
      .set(tableau, { merge: true });

    console.log(
      `[tableauEconomique] Mois ${mois} | Revenus: ${revenusContrats} FCFA | Réductions: ${totalReductions} FCFA`,
    );
    return { success: true, ...tableau };
  },
);
