const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.addDepot = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated.",
    );
  }

  const { id_citoyen, id_agent, categorie, poids, point, bonus_trieee } = data;

  // Validation
  if (!id_citoyen || !id_agent || !categorie || poids <= 0 || point <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields.",
    );
  }

  try {
    const batch = admin.firestore().batch();

    // Add depot
    const depotRef = admin.firestore().collection("depots").doc();
    batch.set(depotRef, {
      id_citoyen,
      id_agent,
      categorie,
      poids,
      points,
      bonus_trieee: !!bonus_trieee,
      date: admin.firestore.Timestamp.now(),
    });

    // Add points to citoyen
    const userRef = admin
      .firestore()
      .collection("utilisateurs")
      .doc(id_citoyen);
    batch.update(userRef, {
      points: admin.firestore.FieldValue.increment(point),
    });

    // Update bac fill (if exists)
    const bacRef = admin.firestore().collection("bacs").doc(id_agent);
    batch.update(
      bacRef,
      {
        remplissage_actuel: admin.firestore.FieldValue.increment(point * 0.1), // Arbitrary fill %
      },
      { merge: true },
    );

    await batch.commit();

    return { success: true, depotId: depotRef.id, points: point };
  } catch (error) {
    console.error("Add depot error:", error);
    throw new functions.https.HttpsError("internal", "Failed to add depot.");
  }
});
