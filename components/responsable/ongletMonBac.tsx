import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";
import { BacInfo } from "./types";

export default function OngletMonBac() {
  const [bac, setBac] = useState<BacInfo | null>(null);
  const [chargement, setChargement] = useState(true);
  const userUid = auth.currentUser?.uid;

  useEffect(function () {
    if (userUid) {
      chargerBac();
    } else {
      setChargement(false);
    }
  }, []);

  async function chargerBac() {
    if (!userUid) {
      setChargement(false);
      return;
    }
    try {
      const snapUser = await getDoc(doc(db, "utilisateurs", userUid));
      if (!snapUser.exists()) {
        setChargement(false);
        return;
      }
      const userData = snapUser.data();
      const bacId = userData.point_depot;
      if (!bacId) {
        setChargement(false);
        return;
      }
      const snapBac = await getDoc(doc(db, "bacs", bacId));
      if (snapBac.exists()) {
        const data = snapBac.data();
        setBac({
          id: bacId,
          capacite_max: data.capacite_max || 50,
          remplissage_actuel: data.remplissage_actuel || 0,
          etat: data.etat || "normal",
          localisation: data.localisation || "Non définie",
          derniere_collecte: data.derniere_collecte || null,
        });
      }
    } catch (erreur) {
      console.log("Erreur chargement bac:", erreur);
    } finally {
      setChargement(false);
    }
  }

  function obtenirCouleurEtat(etat: string): string {
    if (etat === "plein") {
      return couleur.erreur;
    }
    if (etat === "bientôt plein") {
      return "#FFA500";
    }
    if (etat === "normal") {
      return couleur.vert;
    }
    return couleur.blanc;
  }

  function obtenirIconeEtat(etat: string): string {
    if (etat === "plein") {
      return "alert-circle";
    }
    if (etat === "bientôt plein") {
      return "warning";
    }
    if (etat === "normal") {
      return "checkmark-circle";
    }
    return "help-circle";
  }

  function formaterDate(timestamp: any): string {
    if (!timestamp) {
      return "Jamais";
    }
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function calculerPourcentage(actuel: number, max: number): number {
    if (max === 0) {
      return 0;
    }
    const pct = (actuel / max) * 100;
    return Math.min(pct, 100);
  }

  if (chargement) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  if (!bac) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Ionicons name="cube-outline" size={48} color={couleur.dore} />
        <Text
          style={{
            color: couleur.blanc,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Aucun bac n'est actuellement affecté
        </Text>
        <Text
          style={{
            color: "#ccc",
            marginTop: 8,
            textAlign: "center",
            fontSize: 12,
          }}
        >
          Contactez un administrateur pour affecter un bac à votre compte
        </Text>
      </View>
    );
  }

  const pourcentageRemplissage = calculerPourcentage(
    bac.remplissage_actuel,
    bac.capacite_max
  );
  const couleurBarre = obtenirCouleurEtat(bac.etat);
  const iconeBac = obtenirIconeEtat(bac.etat);

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
      }}
    >
      {/* En-tête avec état */}
      <View
        style={{
          backgroundColor: "rgba(41, 79, 120, 0.6)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          alignItems: "center",
          borderLeftWidth: 4,
          borderLeftColor: couleurBarre,
        }}
      >
        <Ionicons name={iconeBac as any} size={40} color={couleurBarre} />
        <Text
          style={{
            color: couleurBarre,
            fontSize: 16,
            fontWeight: "bold",
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          État: {bac.etat}
        </Text>
      </View>

      {/* Barre de remplissage */}
      <View
        style={{
          backgroundColor: "rgba(41, 79, 120, 0.4)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: "rgba(201, 168, 76, 0.3)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
            Remplissage
          </Text>
          <Text style={{ color: couleur.dore, fontWeight: "bold" }}>
            {pourcentageRemplissage.toFixed(0)}%
          </Text>
        </View>

        <View
          style={{
            height: 24,
            backgroundColor: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <View
            style={{
              height: "100%",
              width: (pourcentageRemplissage + "%") as any,
              backgroundColor: couleurBarre,
              borderRadius: 12,
            }}
          />
        </View>

        <Text style={{ color: "#ccc", fontSize: 12 }}>
          {bac.remplissage_actuel} kg / {bac.capacite_max} kg
        </Text>
      </View>

      {/* Infos détaillées */}
      <View
        style={{
          backgroundColor: "rgba(41, 79, 120, 0.4)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: "rgba(201, 168, 76, 0.3)",
        }}
      >
        <Text style={stylesTitre.sousTitre}>Détails du bac</Text>

        <View style={{ marginVertical: 12, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="barcode-outline" size={20} color={couleur.dore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>Identifiant</Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {bac.id}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons
              name="location-outline"
              size={20}
              color={couleur.dore}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>Localisation</Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {bac.localisation}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="cube-outline" size={20} color={couleur.dore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>
                Capacité maximale
              </Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {bac.capacite_max} kg
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="time-outline" size={20} color={couleur.dore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>
                Dernière collecte
              </Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {formaterDate(bac.derniere_collecte)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Alerte si bac plein */}
      {bac.etat === "plein" && (
        <View
          style={{
            backgroundColor: "rgba(94, 41, 35, 0.5)",
            borderRadius: 12,
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: couleur.erreur,
          }}
        >
          <View
            style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
          >
            <Ionicons name="alert-circle" size={24} color={couleur.erreur} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: couleur.erreur, fontWeight: "bold" }}>
                Bac plein !
              </Text>
              <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
                Veuillez contacter le service de collecte pour vider le bac
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}