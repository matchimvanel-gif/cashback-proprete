/*
  POST /api/add-depot
  Appelée depuis l'app responsable pour enregistrer un dépôt.
  Corps JSON attendu :
    {
      "id_citoyen": "uid Firebase du citoyen",
      "id_agent":   "uid Firebase du responsable",
      "categorie":  "mini" | "petit" | "moyen" | "grand",
      "poids":      5,        (en kg)
      "point":      10,       (calculé côté app)
      "bonus_tri":  false
    }
  Réponse JSON :
    {
      "success": true,
      "depotId": "...",
      "points": 10,
      "remplissageBac": 42,
      "bacPlein": false
    }

  SÉCURITÉ :
    On vérifie le header Authorization : Bearer <idToken Firebase>
    L'idToken est obtenu côté app avec auth.currentUser.getIdToken()
    et vérifié ici avec admin.auth().verifyIdToken()
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin, { db, fieldValue, timestamp } from "../../api/cashback-functions/_firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {

  /* Autoriser les requêtes OPTIONS (CORS preflight) */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  /* Seules les requêtes POST sont acceptées */
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Méthode non autorisée. Utilisez POST." });
  }

  /* ── Vérification du token Firebase ── */
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Token manquant. Ajoutez Authorization: Bearer <idToken>." });
  }
  const idToken = authHeader.split("Bearer ")[1];

  let tokenDecode: admin.auth.DecodedIdToken;
  try {
    tokenDecode = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ success: false, error: "Token invalide ou expiré." });
  }

  /* ── Vérification que l'appelant est bien un responsable ── */
  const snapAgent = await db.collection("utilisateurs").doc(tokenDecode.uid).get();
  if (!snapAgent.exists || snapAgent.data()?.role !== "responsable") {
    return res.status(403).json({ success: false, error: "Seuls les responsables peuvent enregistrer des dépôts." });
  }

  /* ── Récupération et validation des données ── */
  const { id_citoyen, id_agent, categorie, poids, point, bonus_tri } = req.body;

  if (!id_citoyen || !id_agent || !categorie || !poids || !point) {
    return res.status(400).json({ success: false, error: "Champs obligatoires manquants : id_citoyen, id_agent, categorie, poids, point." });
  }
  if (id_agent !== tokenDecode.uid) {
    return res.status(403).json({ success: false, error: "L'id_agent ne correspond pas au token fourni." });
  }
  if (point <= 0 || poids <= 0) {
    return res.status(400).json({ success: false, error: "Le poids et les points doivent être supérieurs à 0." });
  }

  /* ── Vérification que le citoyen existe ── */
  const snapCitoyen = await db.collection("utilisateurs").doc(id_citoyen).get();
  if (!snapCitoyen.exists || snapCitoyen.data()?.role !== "citoyen") {
    return res.status(404).json({ success: false, error: "Citoyen introuvable ou rôle invalide." });
  }

  /* ── Calcul du remplissage du bac ── */
  const snapBac = await db.collection("bacs").doc(id_agent).get();
  const donneesBac = snapBac.exists ? snapBac.data() : null;
  const capaciteMax = donneesBac?.capacite_max || 50;
  const remplissageActuel = donneesBac?.remplissage_actuel || 0;
  const incrementRemplissage = (poids / capaciteMax) * 100;
  const nouveauRemplissage = Math.min(remplissageActuel + incrementRemplissage, 100);

  try {
    /* ── Batch atomique : 3 écritures ensemble ── */
    const batch = db.batch();

    /* 1. Créer le dépôt */
    const depotRef = db.collection("depots").doc();
    batch.set(depotRef, {
      id_citoyen,
      id_agent,
      categorie,
      poids,
      point,
      bonus_tri: bonus_tri === true,
      date: timestamp.now(),
    });

    /* 2. Ajouter les points au citoyen */
    batch.update(db.collection("utilisateurs").doc(id_citoyen), {
      point: fieldValue.increment(point),
    });

    /* 3. Mettre à jour le remplissage du bac */
    if (snapBac.exists) {
      batch.update(db.collection("bacs").doc(id_agent), {
        remplissage_actuel: nouveauRemplissage,
      });
    }

    await batch.commit();

    /* ── Signalement automatique si bac >= 95% ── */
    if (nouveauRemplissage >= 95) {
      const snapSignalement = await db.collection("signalements")
        .where("id_auteur", "==", id_agent)
        .where("type", "==", "bac_plein")
        .where("traite", "==", false)
        .limit(1)
        .get();

      if (snapSignalement.empty) {
        await db.collection("signalements").add({
          id_auteur: id_agent,
          type: "bac_plein",
          localisation: donneesBac?.localisation || "",
          latitude: 0,
          longitude: 0,
          traite: false,
          remplissage: nouveauRemplissage,
          date: timestamp.now(),
        });
      }
    }

    return res.status(200).json({
      success: true,
      depotId: depotRef.id,
      points: point,
      remplissageBac: Math.round(nouveauRemplissage),
      bacPlein: nouveauRemplissage >= 95,
    });

  } catch (erreur: any) {
    console.error("Erreur add-depot:", erreur);
    return res.status(500).json({ success: false, error: erreur.message });
  }
}
