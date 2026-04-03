import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: "cash-back-de-proprete",
  clientEmail: "firebase-adminsdk-fbsvc@cash-back-de-proprete.iam.gserviceaccount.com",
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const maintenant = new Date();
    const trenteJoursAvant = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);

    const etablissementsRef = db.collection('etablissements');
    const snapshot = await etablissementsRef.where('dateRenouvellement', '<=', trenteJoursAvant).get();

    let updatedCount = 0;

    const batch = db.batch();

    snapshot.forEach((doc) => {
      const nouvelleDate = new Date(maintenant.getTime() + 30 * 24 * 60 * 60 * 1000);

      batch.update(doc.ref, {
        montantContrat: 25000,
        dateRenouvellement: nouvelleDate,
        updatedAt: maintenant,
      });
      updatedCount++;
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      updatedCount,
      message: `${updatedCount} établissements renouvelés avec succès.`,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}