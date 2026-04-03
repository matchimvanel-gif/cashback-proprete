import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "cash-back-de-proprete",
      clientEmail: "firebase-adminsdk-fbsvc@cash-back-de-proprete.iam.gserviceaccount.com",
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    }),
  });
}

const db = admin.firestore();

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const snapshot = await db.collection('etablissements').get();
    let updatedCount = 0;
    const batch = db.batch();
    const maintenant = new Date();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const updates: any = {};

      // Ajouter les champs manquants
      if (data.montantContrat === undefined) {
        updates.montantContrat = 25000;
      }
      if (data.dateRenouvellement === undefined) {
        updates.dateRenouvellement = new Date(maintenant.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 jours
      }
      if (data.createdAt === undefined) {
        updates.createdAt = maintenant;
      }
      if (data.updatedAt === undefined) {
        updates.updatedAt = maintenant;
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        updatedCount++;
      }
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      updatedCount,
      message: `${updatedCount} établissements mis à jour avec les champs manquants.`
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
}