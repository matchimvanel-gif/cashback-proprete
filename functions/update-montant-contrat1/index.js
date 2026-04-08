import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function ({ req, res, log, error }) {

  log('Début de la fonction');

  // Initialiser Firebase Admin
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });

  const db = getFirestore(app);

  let nombreMisAJour = 0;
  const maintenant = new Date();

  try {
    // Récupérer tous les établissements
    const snapshot = await db.collection('etablissements').get();

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Calculer si dateRenouvellement est dépassée de 30 jours
      let doitRenouveler = false;

      if (!data.dateRenouvellement) {
        // Le champ n'existe pas encore
        doitRenouveler = true;
        log('Champ dateRenouvellement manquant pour : ' + doc.id);
      } else {
        const dateRenouvellement = new Date(data.dateRenouvellement);
        const differenceJours = (maintenant - dateRenouvellement) / (1000 * 60 * 60 * 24);
        if (differenceJours > 30) {
          doitRenouveler = true;
        }
      }

      if (doitRenouveler) {
        const nouvelleDate = new Date(maintenant);
        nouvelleDate.setDate(nouvelleDate.getDate() + 30);

        // merge: true crée le champ s'il n'existe pas
        await doc.ref.set({
          montantContrat: 25000,
          dateRenouvellement: nouvelleDate.toISOString(),
          updatedAt: maintenant.toISOString()
        }, { merge: true });

        nombreMisAJour++;
        log('Contrat renouvelé : ' + doc.id);
      }
    }

    log('Fin - ' + nombreMisAJour + ' contrats renouvelés');

    return res.json({
      success: true,
      nombreMisAJour: nombreMisAJour,
      message: nombreMisAJour + ' contrat(s) renouvelé(s)'
    });

  } catch (err) {
    error('Erreur : ' + err.message);
    return res.json({ success: false, message: err.message }, 500);
  }
}