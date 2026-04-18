/*
  Fichier utilitaire pour appeler les APIs Vercel depuis l'app.
  Chaque fonction récupère le idToken Firebase de l'utilisateur connecté
  et l'envoie dans le header Authorization.

  Utilisation dans un composant :
    import { appelAddDepot } from "../../constants/api";
    const resultat = await appelAddDepot({ id_citoyen, id_agent, ... });
*/

import { auth } from "../firebaseConfig";

/* URL de base de ton projet Vercel */
const BASE_URL = "https://cashback-proprete.vercel.app";

/* ── Helper : récupère le token Firebase de l'utilisateur connecté ── */
async function obtenirToken(): Promise<string> {
  const utilisateur = auth.currentUser;
  if (!utilisateur) {
    throw new Error("Aucun utilisateur connecté.");
  }
  return utilisateur.getIdToken();
}

/* ── Helper : appel générique vers une route API ── */
async function appelAPI(route: string, corps: object): Promise<any> {
  const token = await obtenirToken();

  const reponse = await fetch(BASE_URL + route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify(corps),
  });

  const donnees = await reponse.json();

  if (!reponse.ok || !donnees.success) {
    throw new Error(donnees.error || "Erreur serveur.");
  }

  return donnees;
}

/* ──────────────────────────────────────────────────────────────────────────
   appelAddDepot
   Appelée depuis ongletDepot.tsx (responsable) au moment de confirmer.
   ────────────────────────────────────────────────────────────────────────── */
export async function appelAddDepot(params: {
  id_citoyen: string;
  id_agent: string;
  categorie: string;
  poids: number;
  point: number;
  bonus_tri: boolean;
}): Promise<{
  success: boolean;
  depotId: string;
  points: number;
  remplissageBac: number;
  bacPlein: boolean;
}> {
  return appelAPI("/api/add-depot", params);
}

/* ──────────────────────────────────────────────────────────────────────────
   appelValiderCoupon
   Appelée depuis l'app établissement après le scan QR du coupon.
   ────────────────────────────────────────────────────────────────────────── */
export async function appelValiderCoupon(couponId: string): Promise<{
  success: boolean;
  message: string;
  pointsDeduits: number;
  nomOffre: string;
}> {
  return appelAPI("/api/valider-coupon", { couponId });
}

/* ──────────────────────────────────────────────────────────────────────────
   appelGenererCoupons
   Appelée une seule fois depuis inscription.tsx après la création du citoyen.
   ────────────────────────────────────────────────────────────────────────── */
export async function appelGenererCoupons(uid: string): Promise<{
  success: boolean;
  coupons: string[];
}> {
  return appelAPI("/api/generer-coupons", { uid });
}
