import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";

type ResponsableInfo = {
  nom: string;
  email: string;
  point_depot: string;
};

export default function OngletAccueil() {
  const [responsable, setResponsable] = useState<ResponsableInfo | null>(null);
  const [chargement, setChargement] = useState(true);
  const userUid = auth.currentUser?.uid;

  useEffect(function () {
    chargerInfosResponsable();
  }, []);

  async function chargerInfosResponsable() {
    if (!userUid) {
      setChargement(false);
      return;
    }

    try {
      const snapUser = await getDoc(doc(db, "utilisateurs", userUid));
      if (snapUser.exists()) {
        const data = snapUser.data();
        setResponsable({
          nom: data.nom || "Responsable",
          email: data.email || "",
          point_depot: data.point_depot || "",
        });
      }
    } catch (erreur) {
      console.log("Erreur chargement responsable:", erreur);
    } finally {
      setChargement(false);
    }
  }

  if (chargement) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      >
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
      }}
    >
      {/* Section bienvenue */}
      <View
        style={{
          backgroundColor: "rgba(41, 79, 120, 0.6)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          borderLeftWidth: 4,
          borderLeftColor: couleur.dore,
        }}
      >
        <Text
          style={{
            color: couleur.doreClair,
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 8,
          }}
        >
          Bienvenue, {responsable?.nom} !
        </Text>
        <Text style={{ color: "#ccc", fontSize: 14, lineHeight: 22 }}>
          Vous êtes responsable de collecte pour le programme Cashback Propreté.
          Enregistrez les dépôts de déchets, consultez l'historique et gérez
          votre bac d'affectation.
        </Text>
      </View>

      {/* Section infos responsable */}
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
        <Text style={stylesTitre.sousTitre}>Vos informations</Text>

        <View style={{ marginVertical: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <Ionicons name="person-outline" size={20} color={couleur.dore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>Nom</Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {responsable?.nom}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <Ionicons name="mail-outline" size={20} color={couleur.dore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>Email</Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {responsable?.email}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Ionicons name="trash-outline" size={20} color={couleur.dore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ccc", fontSize: 12 }}>
                Bac affecté
              </Text>
              <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                {responsable?.point_depot || "Non affecté"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Section conseils */}
      <View
        style={{
          backgroundColor: "rgba(76, 205, 196, 0.1)",
          borderRadius: 12,
          padding: 16,
          borderLeftWidth: 3,
          borderLeftColor: couleur.turquoise,
        }}
      >
        <Text style={[stylesTitre.sousTitre, { color: couleur.turquoise }]}>
          💡 Guide rapide
        </Text>
        <View style={{ marginVertical: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ color: couleur.blanc, fontSize: 14 }}>
              1️⃣ Allez à l'onglet "Dépôts"
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ color: couleur.blanc, fontSize: 14 }}>
              2️⃣ Scannez le QR code du citoyen
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ color: couleur.blanc, fontSize: 14 }}>
              3️⃣ Sélectionnez catégorie et poids
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ color: couleur.blanc, fontSize: 14 }}>
              4️⃣ Confirmez et enregistrez
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}