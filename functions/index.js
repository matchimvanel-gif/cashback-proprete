/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
    import * as functions from "firebase-functions";
    import * as admin from "firebase-admin";

    admin.initializeApp();

    export const addMontantToExistingEtablissements = functions.https.onCall(async (data, context) => {
        
        // Sécurité : Seul l'admin Hyzakam peut exécuter cette fonction
        if (!context.auth || context.auth.uid !== "cJdPoZIqE8a6hnSmPNO348TB2hI2") {  
            throw new functions.https.HttpsError("permission-denied", "Accès réservé à l'admin");
        }

        const etablissementsRef = admin.firestore().collection("etablissements");
        const snapshot = await etablissementsRef.get();

        if (snapshot.empty) {
            return { success: true, message: "Aucun établissement trouvé" };
        }

        const maintenant = admin.firestore.Timestamp.now();
        let updatedCount = 0;

        const batch = admin.firestore().batch();

        snapshot.docs.forEach((doc) => {
            const data = doc.data();

            // Si le document n'a pas encore les nouveaux champs
            if (data.montantContrat === undefined || data.dateRenouvellement === undefined) {
                
                batch.update(doc.ref, {
                    montantContrat: 25000,                    // Valeur initiale
                    dateRenouvellement: maintenant,           // Date du jour
                    createdAt: data.createdAt || maintenant,  // Garde l'ancien createdAt s'il existe
                    updatedAt: maintenant,                    // Met à jour la date de modification
                });
                
                updatedCount++;
            }
        });

        await batch.commit();

        console.log(`${updatedCount} établissements mis à jour avec succès.`);

        return {
            success: true,
            message: `${updatedCount} établissements ont été mis à jour avec montantContrat = 25000 et dateRenouvellement.`,
            updatedCount
        };
    });
// });
