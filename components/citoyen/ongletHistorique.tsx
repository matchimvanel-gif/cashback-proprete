// Onglet Historique — Dépôts du citoyen du plus récent au plus ancien
import { Ionicons } from "@expo/vector-icons";
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Depot {
  id: string;
  date: string;
  categorie: string;
  poids: number;
  pointsBase: number;
  bonusTri: number;
  totalPoints: number;
  tri: boolean;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OngletHistorique() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [chargement, setChargement] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);

  const uid = auth.currentUser?.uid;

  useEffect(
    function () {
      if (!uid) {
        setChargement(false);
        return;
      }

      // Écoute en temps réel — 50 derniers dépôts du citoyen
      const qDepots = query(
        collection(db, "depots"),
        where("id_citoyen", "==", uid),
        orderBy("date", "desc"),
        limit(50),
      );

      const desabonner = onSnapshot(
        qDepots,
        function (snap) {
          const liste: Depot[] = [];
          let total = 0;

          snap.forEach(function (docDepot) {
            const data = docDepot.data();
            const dateDepot = data.date?.toDate
              ? data.date.toDate()
              : new Date();
            const pts = data.totalPoints || data.points || 0;
            total += pts;

            liste.push({
              id: docDepot.id,
              date: dateDepot.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              categorie: data.categorie || "Non spécifié",
              poids: data.poids || 0,
              pointsBase: data.pointsBase || 0,
              bonusTri: data.bonusTri || 0,
              totalPoints: pts,
              tri: data.tri || false,
            });
          });

          setDepots(liste);
          setTotalPoints(total);
          setChargement(false);
        },
        function (erreur) {
          console.error("Erreur historique dépôts:", erreur);
          setChargement(false);
        },
      );

      return function () {
        desabonner();
      };
    },
    [uid],
  );

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
      <Text style={stylesTitre.titre}>Mon Historique</Text>

      {/* ── RÉSUMÉ TOTAL ── */}
      <View
        style={{
          backgroundColor: "rgba(41,79,120,0.85)",
          borderRadius: 20,
          padding: 18,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: couleur.dore,
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Text
            style={{ color: couleur.dore, fontSize: 28, fontWeight: "bold" }}
          >
            {depots.length}
          </Text>
          <Text style={{ color: "#ccc", fontSize: 12 }}>Dépôts totaux</Text>
        </View>
        <View
          style={{
            width: 1,
            height: 40,
            backgroundColor: "rgba(201,168,76,0.4)",
          }}
        />
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              color: couleur.turquoise,
              fontSize: 28,
              fontWeight: "bold",
            }}
          >
            {totalPoints.toLocaleString("fr-FR")}
          </Text>
          <Text style={{ color: "#ccc", fontSize: 12 }}>Points gagnés</Text>
        </View>
      </View>

      {/* ── LISTE DES DÉPÔTS ── */}
      {depots.length === 0 ? (
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
          <Ionicons name="trash-outline" size={40} color={couleur.dore} />
          <Text style={{ color: "#ccc", marginTop: 10, textAlign: "center" }}>
            Aucun dépôt enregistré.{"\n"}Vos dépôts apparaîtront ici.
          </Text>
        </View>
      ) : (
        depots.map(function (depot) {
          return (
            <View
              key={depot.id}
              style={{
                backgroundColor: "rgba(41,79,120,0.8)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: depot.tri ? couleur.turquoise : couleur.dore,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: couleur.blanc,
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    {depot.categorie}
                  </Text>
                  <Text style={{ color: "#ccc", fontSize: 13, marginTop: 3 }}>
                    {depot.poids}g • {depot.date}
                  </Text>
                  {depot.tri && (
                    <Text
                      style={{
                        color: couleur.turquoise,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      ♻️ Tri effectué — +{depot.bonusTri} pts bonus
                    </Text>
                  )}
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      color: couleur.dore,
                      fontWeight: "bold",
                      fontSize: 20,
                    }}
                  >
                    +{depot.totalPoints}
                  </Text>
                  <Text style={{ color: "#ccc", fontSize: 11 }}>points</Text>
                </View>
              </View>

              {/* Détail des points si bonus tri */}
              {depot.bonusTri > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    flexDirection: "row",
                    gap: 15,
                    backgroundColor: "rgba(78,205,196,0.1)",
                    padding: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "#ccc", fontSize: 12 }}>
                    Base : {depot.pointsBase} pts
                  </Text>
                  <Text style={{ color: couleur.turquoise, fontSize: 12 }}>
                    + Bonus tri : {depot.bonusTri} pts
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}

      {depots.length === 50 && (
        <Text
          style={{
            color: "#ccc",
            textAlign: "center",
            fontSize: 12,
            marginTop: 10,
          }}
        >
          Affichage limité aux 50 derniers dépôts
        </Text>
      )}
    </ScrollView>
  );
}
