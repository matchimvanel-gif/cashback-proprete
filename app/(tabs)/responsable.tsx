import { Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { ComponentProps, useState } from "react";
import {
  ImageBackground,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OngletAccueil from "../../components/responsable/ongletAccueil";
import OngletDepot from "../../components/responsable/ongletDepot";
import OngletHistorique from "../../components/responsable/ongletHistorique";
import OngletMonBac from "../../components/responsable/ongletMonBac";
import { couleur } from "../../constants/animation";
import { auth } from "../../firebaseConfig";
import { router } from "expo-router";

export default function ecranResponsable() {
  const [ongletActif, setOngletActif] = useState("accueil");
  const [menuOuvert, setMenuOuvert] = useState(false);

  type NomIcone = ComponentProps<typeof Ionicons>["name"];

  const onglets: { id: string; icone: NomIcone; iconeActif: NomIcone; label: string }[] = [
    {
      id: "accueil",
      icone: "home-outline",
      iconeActif: "home",
      label: "Accueil",
    },
    {
      id: "depots",
      icone: "trash-outline",
      iconeActif: "trash",
      label: "Dépôts",
    },
    {
      id: "historique",
      icone: "time-outline",
      iconeActif: "time",
      label: "Historique",
    },
    {
      id: "monBac",
      icone: "cube-outline",
      iconeActif: "cube",
      label: "Mon Bac",
    },
  ];

  function renduContenu() {
    if (ongletActif === "accueil") {
      return <OngletAccueil />;
    }
    if (ongletActif === "depots") {
      return <OngletDepot />;
    }
    if (ongletActif === "historique") {
      return <OngletHistorique />;
    }
    if (ongletActif === "monBac") {
      return <OngletMonBac />;
    }
  }

  async function Deconnexion() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  }

  return (
    <ImageBackground
      source={require("../../image/abstrait-bleu-or-moderne-formes-courbes-bleu-marine-fonce-or-fond-lignes-luxe-elegance-conception-modele-abstrait-conception-pour-presentation-banniere-couverture_181182-15981.jpg")}
      resizeMode="cover"
      style={{ flex: 1, width: "100%", height: "100%" }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        {/* Header avec titre et menu */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderBottomColor: couleur.dore,
          }}
        >
          <Text
            style={{
              color: couleur.doreClair,
              fontSize: 18,
              fontWeight: "bold",
              marginTop: 15,
            }}
          >
            Cashback Propreté
          </Text>

          <TouchableOpacity onPress={function () {
            setMenuOuvert(!menuOuvert);
          }}>
            <Ionicons
              name="menu"
              size={28}
              color={couleur.dore}
              style={{ marginTop: 15 }}
            />
          </TouchableOpacity>
        </View>

        {/* Menu hamburger */}
        {menuOuvert && (
          <View
            style={{
              position: "absolute",
              top: 65,
              right: 0,
              backgroundColor: couleur.marine,
              borderLeftWidth: 1,
              borderBottomWidth: 1,
              borderColor: couleur.dore,
              borderBottomLeftRadius: 20,
              paddingVertical: 10,
              zIndex: 999,
              width: 200,
            }}
          >
            <TouchableOpacity
              style={{ padding: 15, flexDirection: "row", gap: 10 }}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={couleur.dore}
              />
              <Text style={{ color: couleur.blanc }}>Paramètres</Text>
            </TouchableOpacity>

            <View
              style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.2)",
                marginHorizontal: 15,
              }}
            />

            <TouchableOpacity
              style={{ padding: 15, flexDirection: "row", gap: 10 }}
              onPress={Deconnexion}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={couleur.erreur}
              />
              <Text style={{ color: couleur.erreur }}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contenu principal */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1 }}>
            {renduContenu()}
          </View>
        </ScrollView>

        {/* Barre d'onglets en bas */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: couleur.marine,
            borderTopWidth: 1,
            borderTopColor: couleur.dore,
            paddingBottom: 10,
            paddingTop: 8,
          }}
        >
          {onglets.map(function (onglet) {
            return (
              <TouchableOpacity
                key={onglet.id}
                style={{ flex: 1, alignItems: "center", paddingVertical: 5 }}
                onPress={function () {
                  setOngletActif(onglet.id);
                }}
              >
                <Ionicons
                  name={
                    ongletActif === onglet.id
                      ? onglet.iconeActif
                      : onglet.icone
                  }
                  size={22}
                  color={ongletActif === onglet.id ? couleur.dore : "#ccc"}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: ongletActif === onglet.id ? couleur.dore : "#ccc",
                    fontWeight: ongletActif === onglet.id ? "bold" : "normal",
                    marginTop: 2,
                  }}
                >
                  {onglet.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}