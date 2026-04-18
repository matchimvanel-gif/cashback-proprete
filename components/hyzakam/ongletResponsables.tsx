import { Ionicons } from "@expo/vector-icons";
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    setDoc,
    Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { db } from "../../firebaseConfig";

// Définition du type Responsable selon tes besoins
type Responsable = {
  id: string;
  Id_contrat: string;
  nom: string;
  email: string;
  numero_de_telephone: string;
  points_depot: string;
  statut: "valide";
  date_demande: any;
};

export default function OngletResponsables() {
  // États pour la liste et le chargement
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState(false);

  // États pour les Modals
  const [ficheOuverte, setFicheOuverte] = useState<Responsable | null>(null);
  const [popupAjout, setPopupAjout] = useState(false);

  // États du formulaire
  const [nomNouv, setNomNouv] = useState("");
  const [emailNouv, setEmailNouv] = useState("");
  const [telNouv, setTelNouv] = useState("");
  const [pointsDepotNouv, setPointDepotNouv] = useState("");
  const [idContratNouv, setIdContratNouv] = useState("");

  useEffect(function () {
    chargerResponsables();
  }, []);

  // async function nombreRespo(){

  // }

  async function chargerResponsables() {
    setChargement(true);
    try {
      const q = query(
        collection(db, "RespoID"),
        orderBy("date_demande", "desc"),
      );
      const snapshot = await getDocs(q);
      const liste = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Responsable[];
      setResponsables(liste);
    } catch (e) {
      console.error("Erreur chargement responsables:", e);
    } finally {
      setChargement(false);
    }
  }

  function genererCode(): string {
    const lettres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz";
    const chiffres = "0123456789";
    let prefix = "";
    let suffix = "";
    for (let i = 0; i < 4; i++) {
      prefix += lettres[Math.floor(Math.random() * lettres.length)];
    }
    for (let i = 0; i < 4; i++) {
      suffix += chiffres[Math.floor(Math.random() * chiffres.length)];
    }
    return `${prefix}-${suffix}`;
  }

  async function envoyerWhatsApp(telephone: string, code: string) {
    const numeroPropre = telephone.startsWith("237")
      ? telephone
      : `237${telephone}`;
    const message = `Bonjour ! Votre code responsable pour Cashback de Propreté est : ${code}.`;
    const url = `whatsapp://send?phone=${numeroPropre}&text=${encodeURIComponent(message)}`;
    try {
      const supporte = await Linking.canOpenURL(url);
      if (supporte) {
        await Linking.openURL(url);
      } else {
        alert("WhatsApp n'est pas installé");
      }
    } catch (error) {
      console.log("Erreur WhatsApp:", error);
    }
  }

  function ouvrirPopupAjout() {
    setIdContratNouv(genererCode());
    setNomNouv("");
    setEmailNouv("");
    setTelNouv("");
    setPointDepotNouv("");
    setPopupAjout(true);
  }

  async function ajouterResponsable() {
    if (!nomNouv || !emailNouv || !telNouv || !pointsDepotNouv) {
      alert("Veuillez remplir tous les champs");
      return;
    }

    setActionEnCours(true);
    try {
      const nouveauRespo = {
        code_secret: idContratNouv,
        nom: nomNouv,
        email: emailNouv.trim(),
        numero_de_telephone: telNouv,
        points_depot: pointsDepotNouv,
        statut: "valide",
        date_demande: Timestamp.now(),
        utilise: false,
      };

      await setDoc(doc(collection(db, "RespoID")), nouveauRespo);

      // On ferme le popup avant d'ouvrir WhatsApp pour fluidifier l'UX
      setPopupAjout(false);
      await envoyerWhatsApp(telNouv, idContratNouv);
      chargerResponsables();
    } catch (e) {
      console.error("Erreur ajout:", e);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setActionEnCours(false);
    }
  }

  // Fonction pour formater la date Firestore
  function formaterDate(ts: any) {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("fr-FR");
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Text style={stylesTitre.titre}>Responsables</Text>
        <TouchableOpacity
          style={{
            backgroundColor: couleur.dore,
            padding: 10,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
          onPress={ouvrirPopupAjout}
        >
          <Ionicons name="add-circle" size={20} color={couleur.marine} />
          <Text style={{ color: couleur.marine, fontWeight: "bold" }}>
            Nouveau
          </Text>
        </TouchableOpacity>
      </View>

      {chargement ? (
        <ActivityIndicator
          size="large"
          color={couleur.dore}
          style={{ marginTop: 50 }}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {responsables.map((respo) => (
            <TouchableOpacity
              key={respo.id}
              onPress={() => setFicheOuverte(respo)}
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: 15,
                borderRadius: 15,
                marginBottom: 10,
                borderLeftWidth: 4,
                borderLeftColor: couleur.turquoise,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text
                  style={{
                    color: couleur.blanc,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  {respo.nom}
                </Text>
                <Text style={{ color: couleur.doreClair, fontSize: 12 }}>
                  📍 {respo.points_depot}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={couleur.dore} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* MODAL FICHE DÉTAILLÉE */}
      <Modal visible={ficheOuverte !== null} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.8)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: couleur.marine,
              borderRadius: 25,
              padding: 25,
              borderWidth: 1,
              borderColor: couleur.dore,
            }}
          >
            <TouchableOpacity
              onPress={() => setFicheOuverte(null)}
              style={{ alignSelf: "flex-end" }}
            >
              <Ionicons
                name="close-circle"
                size={30}
                color={couleur.erreurClair}
              />
            </TouchableOpacity>

            {ficheOuverte && (
              <View style={{ gap: 15 }}>
                <Text
                  style={{
                    color: couleur.dore,
                    fontSize: 22,
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  {ficheOuverte.nom}
                </Text>

                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    padding: 15,
                    borderRadius: 15,
                    gap: 10,
                  }}
                >
                  <Text style={{ color: couleur.blanc }}>
                    📧 {ficheOuverte.email}
                  </Text>
                  <Text style={{ color: couleur.blanc }}>
                    📞 {ficheOuverte.numero_de_telephone}
                  </Text>
                  <Text style={{ color: couleur.blanc }}>
                    📍 Bac : {ficheOuverte.points_depot}
                  </Text>
                  <Text style={{ color: couleur.blanc }}>
                    📅 Créé le : {formaterDate(ficheOuverte.date_demande)}
                  </Text>
                </View>

                <View style={{ alignItems: "center", marginTop: 10 }}>
                  <Text style={{ color: couleur.turquoise, fontSize: 12 }}>
                    CODE D'ACCÈS
                  </Text>
                  <Text
                    style={{
                      color: couleur.blanc,
                      fontSize: 28,
                      fontWeight: "bold",
                      letterSpacing: 2,
                    }}
                  >
                    {ficheOuverte.Id_contrat}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    envoyerWhatsApp(
                      ficheOuverte.numero_de_telephone,
                      ficheOuverte.Id_contrat,
                    )
                  }
                  style={{
                    backgroundColor: "#25D366",
                    padding: 15,
                    borderRadius: 15,
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <Ionicons
                    name="logo-whatsapp"
                    size={24}
                    color={couleur.blanc}
                  />
                  <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
                    Renvoyer le code
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL AJOUT RESPONSABLE */}
      <Modal visible={popupAjout} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: couleur.marine,
              borderRadius: 25,
              padding: 25,
            }}
          >
            <Text
              style={{
                color: couleur.dore,
                fontSize: 20,
                fontWeight: "bold",
                marginBottom: 20,
              }}
            >
              Nouveau Responsable
            </Text>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <TextInput
                placeholder="Nom complet"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={nomNouv}
                onChangeText={setNomNouv}
                style={stylesInput}
              />
              <TextInput
                placeholder="Email"
                keyboardType="email-address"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={emailNouv}
                onChangeText={setEmailNouv}
                style={stylesInput}
              />
              <TextInput
                placeholder="Téléphone (ex: 6XXXXXXXX)"
                keyboardType="phone-pad"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={telNouv}
                onChangeText={setTelNouv}
                style={stylesInput}
              />
              <TextInput
                placeholder="Point de dépôt (Quartier/Bac)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={pointsDepotNouv}
                onChangeText={setPointDepotNouv}
                style={stylesInput}
              />

              <View
                style={{
                  backgroundColor: "rgba(41,79,120,0.9)",
                  padding: 15,
                  borderRadius: 15,
                  marginTop: 10,
                  alignItems: "center",
                  borderStyle: "dashed",
                  borderWidth: 1,
                  borderColor: couleur.dore,
                }}
              >
                <Text style={{ color: couleur.dore, fontSize: 10 }}>
                  CODE GÉNÉRÉ
                </Text>
                <Text
                  style={{
                    color: couleur.blanc,
                    fontSize: 20,
                    fontWeight: "bold",
                  }}
                >
                  {idContratNouv}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => setPopupAjout(false)}
                  style={{
                    flex: 1,
                    padding: 15,
                    borderRadius: 15,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: couleur.blanc }}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={ajouterResponsable}
                  disabled={actionEnCours}
                  style={{
                    flex: 2,
                    padding: 15,
                    borderRadius: 15,
                    backgroundColor: couleur.dore,
                    alignItems: "center",
                  }}
                >
                  {actionEnCours ? (
                    <ActivityIndicator color={couleur.marine} />
                  ) : (
                    <Text style={{ color: couleur.marine, fontWeight: "bold" }}>
                      Enregistrer & Envoyer
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const stylesInput = {
  backgroundColor: "rgba(255,255,255,0.1)",
  color: "#FFF",
  padding: 15,
  borderRadius: 15,
  fontSize: 16,
};
