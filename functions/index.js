const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Limite simple pour éviter trop d'instances
functions.setGlobalOptions({ maxInstances: 10 });

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
 * Le projet peut utiliser id_agent, id_agent ou respoID selon les données.
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
    const id_agent = depot.id_agent || depot.id_agent || depot.respoID || null;

    if (!id_agent) {
      return;
    }

    if (!comptes[id_agent]) {
      comptes[id_agent] = 0;
    }

    comptes[id_agent] += 1;
  });

  return comptes;
}

/**
 * Calcule une moyenne journalière simple sur les 7 jours précédents.
 * On ignore aujourd'hui pour comparer le volume du jour à l'habitude récente.
 */
async function calculerMoyenneGlissanteResponsable(id_agent, debutAujourdHui) {
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
    const idTrouve = depot.id_agent || depot.id_agent || depot.respoID || null;

    if (idTrouve !== id_agent) {
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
async function recupererNomResponsable(id_agent) {
  try {
    const utilisateur = await db.collection("utilisateurs").doc(id_agent).get();

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
  id_agent,
  nom,
  multiplicateur,
  occurence,
  depotsAujourdHui,
  moyenneHabituelle,
}) {
  const aujourdHui = new Date();
  const jour = cleJour(aujourdHui);
  const alerteId = `${id_agent}_${jour}`;

  const donneesAlerte = {
    nom,
    id_agent,
    multiplicateur,
    occurence,
    date: admin.firestore.Timestamp.fromDate(aujourdHui),
    traite: false,
    depotsAujourdHui,
    moyenneHabituelle,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection("alertes")
    .doc(alerteId)
    .set(donneesAlerte, { merge: true });
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
    finAujourdHui,
  );

  const responsables = Object.keys(comptesDuJour);
  let nombreAlertes = 0;

  for (const id_agent of responsables) {
    const depotsAujourdHui = comptesDuJour[id_agent];

    if (depotsAujourdHui < 5) {
      continue;
    }

    const historique = await calculerMoyenneGlissanteResponsable(
      id_agent,
      debutAujourdHui,
    );

    if (historique.nbJoursAvecActivite < 2 || historique.moyenne <= 0) {
      continue;
    }

    const multiplicateurBrut = depotsAujourdHui / historique.moyenne;
    const multiplicateur = Number(multiplicateurBrut.toFixed(2));

    if (multiplicateur < 2) {
      continue;
    }

    const nom = await recupererNomResponsable(id_agent);

    await creerOuMettreAJourAlerte({
      id_agent,
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
        "Accès réservé à l'admin",
      );
    }

    const etablissementsRef = db.collection("etablissements");
    const snapshot = await etablissementsRef.get();

    if (snapshot.empty) {
      return { success: true, message: "Aucun établissement trouvé" };
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
      message: `${updatedCount} établissements ont été mis à jour avec montantContrat = 25000 et dateRenouvellement.`,
      updatedCount,
    };
  },
);

/**
 * Callable simple pour lancer l'analyse manuellement depuis l'admin si besoin.
 */
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
