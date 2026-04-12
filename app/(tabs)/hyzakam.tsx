// Hyzakam@gmail.com  Hyzakam1234 http://localhost:8081/hyzakam
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ImageBackground,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OngletAccueil from "../../components/hyzakam/ongletAcceuil";
import OngletPartenaires from "../../components/hyzakam/ongletPartenaires";
import OngletResponsables from "../../components/hyzakam/ongletResponsables";
import OngletStatistiques from "../../components/hyzakam/ongletStatistiques";
import { couleur } from "../../constants/animation";

export default function ecranHyzakam() {
  const [ongletActif, setOngletActif] = useState("accueil");
  const [menuOuvert, setMenuOuvert] = useState(false);

  const onglets = [
    {
      id: "accueil",
      icone: "home-outline",
      iconeActif: "home",
      label: "Accueil",
    },
    {
      id: "partenaires",
      icone: "storefront-outline",
      iconeActif: "storefront",
      label: "Partenaires",
    },
    {
      id: "responsables",
      icone: "people-outline",
      iconeActif: "people",
      label: "Responsable",
    },
    {
      id: "statistiques",
      icone: "bar-chart-outline",
      iconeActif: "bar-chart",
      label: "Statistique",
    },
  ];

  function renduContenu() {
    if (ongletActif === "accueil") return <OngletAccueil />;
    if (ongletActif === "partenaires") return <OngletPartenaires />;
    if (ongletActif === "responsables") return <OngletResponsables />;
    if (ongletActif === "statistiques") return <OngletStatistiques />;
  }

  return (
    <ImageBackground
      source={require("../../image/abstrait-bleu-or-moderne-formes-courbes-bleu-marine-fonce-or-fond-lignes-luxe-elegance-conception-modele-abstrait-conception-pour-presentation-banniere-couverture_181182-15981.jpg")}
      resizeMode="cover"
      style={{ flex: 1, width: "100%", height: "100%" }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        {/* safeAreaView evite que tout ce qui est contene dans sa balise ne soit cacher par la barre de naviguation etla camera du telephone */}
        {/* Header */}
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

          {/* Bouton menu hamburger */}
          <TouchableOpacity onPress={() => setMenuOuvert(!menuOuvert)}>
            <Ionicons
              name="menu"
              size={28}
              color={couleur.dore}
              style={{ marginTop: 15 }}
            />
          </TouchableOpacity>
        </View>

        {/* Menu hamburger ouvert */}
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
              // zIndex decide de qui est aux dessus de qui lorsque les elements se superpose
              //
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

        {/* Contenu de l'onglet actif */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1 }}>{renduContenu()}</View>
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
          {onglets.map((onglet) => (
            <TouchableOpacity
              key={onglet.id}
              style={{ flex: 1, alignItems: "center", paddingVertical: 5 }}
              onPress={() => setOngletActif(onglet.id)}
            >
              <Ionicons
                name={
                  (ongletActif === onglet.id
                    ? onglet.iconeActif
                    : onglet.icone) as any
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
          ))}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
