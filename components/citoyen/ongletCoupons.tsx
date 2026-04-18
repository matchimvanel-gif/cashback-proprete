// Onglet Coupons — Coupons disponibles et utilises du citoyen
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";
import { DocumentSnapshot } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coupon {
  id: string;
  type: "petit" | "grand";
  valeur: number;
  statut: "bloque" | "disponible" | "utilise";
  seuilDeblocage: number;
  dateDeblocage?: any;
  dateExpiration?: any;
  etablissementId?: string;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

// Calcule le temps restant avant expiration du coupon (24h)
function calculerTempsRestant(dateExpiration: any): string {
  if (!dateExpiration) return "";
  const expiration = dateExpiration.toDate
    ? dateExpiration.toDate()
    : new Date(dateExpiration);
  const maintenant = new Date();
  const diffMs = expiration.getTime() - maintenant.getTime();

  if (diffMs <= 0) return "Expiré";

  const heures = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${heures}h ${minutes}min restantes`;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OngletCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ongletInterne, setOngletInterne] = useState<
    "disponibles" | "utilises"
  >("disponibles");
  const [pointsCitoyen, setPointsCitoyen] = useState(0);

  const uid = auth.currentUser?.uid;

  useEffect(
    function () {
      if (!uid) {
        setChargement(false);
        return;
      }

      // Écoute du solde de points du citoyen pour afficher la progression
      const desabonnerUser = onSnapshot(
        require("firebase/firestore").doc(db, "utilisateurs", uid),
        function (snap : DocumentSnapshot) {
          if (snap.exists()) {
            setPointsCitoyen(snap.data().points || snap.data().point || 0);
          }
        },
      );

      // Écoute en temps réel des coupons du citoyen
      const qCoupons = query(
        collection(db, "coupons"),
        where("id_citoyen", "==", uid),
      );

      const desabonnerCoupons = onSnapshot(
        qCoupons,
        function (snap) {
          const liste: Coupon[] = [];
          snap.forEach(function (docCoupon) {
            const data = docCoupon.data();
            liste.push({
              id: docCoupon.id,
              type: data.type || "petit",
              valeur: data.valeur || 0,
              statut: data.statut || "bloque",
              seuilDeblocage: data.seuilDeblocage || 0,
              dateDeblocage: data.dateDeblocage || null,
              dateExpiration: data.dateExpiration || null,
              etablissementId: data.etablissementId || null,
            });
          });
          setCoupons(liste);
          setChargement(false);
        },
        function (erreur) {
          console.error("Erreur coupons:", erreur);
          setChargement(false);
        },
      );

      return function () {
        desabonnerUser();
        desabonnerCoupons();
      };
    },
    [uid],
  );

  // Séparer les coupons par statut
  const couponsDisponibles = coupons.filter(function (c) {
    return c.statut === "disponible";
  });
  const couponsUtilises = coupons.filter(function (c) {
    return c.statut === "utilise";
  });
  const couponsAffiches =
    ongletInterne === "disponibles" ? couponsDisponibles : couponsUtilises;

  if (chargement) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
      <Text style={stylesTitre.titre}>Mes Coupons</Text>

      {/* ── ONGLETS DISPONIBLES / utiliseS ── */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "rgba(41,79,120,0.6)",
          borderRadius: 15,
          padding: 4,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: "rgba(201,168,76,0.3)",
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              ongletInterne === "disponibles" ? couleur.dore : "transparent",
          }}
          onPress={() => setOngletInterne("disponibles")}
        >
          <Text
            style={{
              color: ongletInterne === "disponibles" ? couleur.marine : "#ccc",
              fontWeight: "bold",
            }}
          >
            Disponibles ({couponsDisponibles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              ongletInterne === "utilises" ? couleur.dore : "transparent",
          }}
          onPress={() => setOngletInterne("utilises")}
        >
          <Text
            style={{
              color: ongletInterne === "utilises" ? couleur.marine : "#ccc",
              fontWeight: "bold",
            }}
          >
            utilises ({couponsUtilises.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── COUPONS BLOQUÉS (progression vers déblocage) ── */}
      {ongletInterne === "disponibles" && (
        <>
          {coupons
            .filter(function (c) {
              return c.statut === "bloque";
            })
            .map(function (coupon) {
              const progression = Math.min(
                100,
                Math.round((pointsCitoyen / coupon.seuilDeblocage) * 100),
              );
              return (
                <View
                  key={coupon.id}
                  style={{
                    backgroundColor: "rgba(41,79,120,0.7)",
                    borderRadius: 20,
                    padding: 18,
                    marginBottom: 15,
                    borderWidth: 1,
                    borderColor: "rgba(201,168,76,0.3)",
                    opacity: 0.8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Ionicons
                        name="lock-closed"
                        size={20}
                        color={couleur.dore}
                      />
                      <Text
                        style={{
                          color: couleur.doreClair,
                          fontWeight: "bold",
                          fontSize: 16,
                        }}
                      >
                        Coupon {coupon.type === "grand" ? "Grand" : "Petit"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: couleur.dore,
                        fontWeight: "bold",
                        fontSize: 20,
                      }}
                    >
                      {coupon.valeur} pts
                    </Text>
                  </View>

                  {/* Barre de progression */}
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      height: 10,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: `${progression}%`,
                        backgroundColor: couleur.turquoise,
                        borderRadius: 10,
                        height: 10,
                      }}
                    />
                  </View>
                  <Text style={{ color: "#ccc", fontSize: 12 }}>
                    {pointsCitoyen} / {coupon.seuilDeblocage} pts pour
                    débloquer ({progression}%)
                  </Text>
                </View>
              );
            })}
        </>
      )}

      {/* ── LISTE DES COUPONS ── */}
      {couponsAffiches.length === 0 ? (
        <View
          style={{
            backgroundColor: "rgba(41,79,120,0.6)",
            padding: 30,
            borderRadius: 20,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(201,168,76,0.3)",
          }}
        >
          <Ionicons name="ticket-outline" size={40} color={couleur.dore} />
          <Text style={{ color: "#ccc", marginTop: 10, textAlign: "center" }}>
            {ongletInterne === "disponibles"
              ? "Aucun coupon disponible pour l'instant."
              : "Aucun coupon utilise pour l'instant."}
          </Text>
        </View>
      ) : (
        couponsAffiches.map(function (coupon) {
          const tempsRestant =
            coupon.statut === "disponible"
              ? calculerTempsRestant(coupon.dateExpiration)
              : "";
          const estExpire = tempsRestant === "Expiré";

          return (
            <View
              key={coupon.id}
              style={{
                backgroundColor: "rgba(41,79,120,0.85)",
                borderRadius: 20,
                padding: 18,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: estExpire
                  ? couleur.erreur
                  : coupon.statut === "disponible"
                    ? couleur.turquoise
                    : "rgba(201,168,76,0.3)",
              }}
            >
              {/* Entête coupon */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: couleur.doreClair,
                    fontWeight: "bold",
                    fontSize: 18,
                  }}
                >
                  {coupon.valeur} pts = {coupon.valeur} FCFA
                </Text>
                <View
                  style={{
                    backgroundColor:
                      coupon.statut === "disponible"
                        ? "rgba(78,205,196,0.2)"
                        : "rgba(201,168,76,0.2)",
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <Text
                    style={{
                      color:
                        coupon.statut === "disponible"
                          ? couleur.turquoise
                          : couleur.dore,
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  >
                    {coupon.statut === "disponible"
                      ? "✅ Disponible"
                      : "✔ utilise"}
                  </Text>
                </View>
              </View>

              {/* QR Code affiché pour les coupons disponibles */}
              {coupon.statut === "disponible" && !estExpire && (
                <View
                  style={{
                    backgroundColor: couleur.blanc,
                    borderRadius: 15,
                    padding: 15,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="qr-code" size={80} color={couleur.marine} />
                  <Text
                    style={{
                      color: couleur.marine,
                      fontSize: 12,
                      marginTop: 8,
                      fontWeight: "bold",
                    }}
                  >
                    ID : {coupon.id.slice(0, 12)}...
                  </Text>
                  <Text
                    style={{
                      color: couleur.marine,
                      fontSize: 11,
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Présentez ce code à l'établissement partenaire
                  </Text>
                </View>
              )}

              {/* Compte à rebours 24h */}
              {coupon.statut === "disponible" && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: estExpire
                      ? "rgba(94,41,35,0.4)"
                      : "rgba(78,205,196,0.15)",
                    padding: 10,
                    borderRadius: 12,
                  }}
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={estExpire ? couleur.erreurClair : couleur.turquoise}
                  />
                  <Text
                    style={{
                      color: estExpire
                        ? couleur.erreurClair
                        : couleur.turquoise,
                      fontSize: 13,
                      fontWeight: "bold",
                    }}
                  >
                    {tempsRestant}
                  </Text>
                </View>
              )}

              {/* Type du coupon */}
              <Text style={{ color: "#ccc", fontSize: 12, marginTop: 8 }}>
                Coupon {coupon.type === "grand" ? "Grand ✦" : "Petit ✧"}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
