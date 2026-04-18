import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";
import { DepotEnregistrement } from "./types";

export default function OngletHistorique() {
  const [depots, setDepots] = useState<DepotEnregistrement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const uidAgent = auth.currentUser?.uid;

  useEffect(function () {
    if (uidAgent) {
      chargerHistorique();
    } else {
      setChargement(false);
    }
  }, []);

  async function chargerHistorique() {
    if (!uidAgent) {
      setChargement(false);
      return;
    }
    try {
      const q = query(
        collection(db, "depots"),
        where("id_agent", "==", uidAgent),
        orderBy("date", "desc"),
        limit(50)
      );
      const snapshots = await getDocs(q);
      const donnees: DepotEnregistrement[] = [];
      snapshots.forEach(function (snap) {
        donnees.push({ id: snap.id, ...(snap.data() as any) });
      });
      setDepots(donnees);
    } catch (erreur) {
      console.log("Erreur chargement historique:", erreur);
    } finally {
      setChargement(false);
    }
  }

  function obtenirCategories(): string[] {
    const categories = new Set<string>();
    depots.forEach(function (depot) {
      categories.add(depot.categorie);
    });
    return Array.from(categories);
  }

  function filtrerDepots(): DepotEnregistrement[] {
    if (filtreCategorie === null) {
      return depots;
    }
    return depots.filter(function (depot) {
      return depot.categorie === filtreCategorie;
    });
  }

  function formaterDate(timestamp: any): string {
    if (!timestamp) {
      return "Date inconnue";
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

  function renduItemDepot(item: DepotEnregistrement) {
    return (
      <View
        style={{
          backgroundColor: "rgba(41, 79, 120, 0.5)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderLeftWidth: 4,
          borderLeftColor: couleur.dore,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: couleur.doreClair, fontWeight: "bold" }}>
              {item.categorie.toUpperCase()}
            </Text>
            <Text style={{ color: "#ccc", fontSize: 12, marginTop: 2 }}>
              {item.poids} kg
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                color: couleur.turquoise,
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              +{item.point} pts
            </Text>
            {item.bonus_tri && (
              <Text style={{ color: couleur.vert, fontSize: 11, marginTop: 2 }}>
                Bonus tri
              </Text>
            )}
          </View>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255,255,255,0.1)",
            marginVertical: 8,
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="time-outline" size={14} color="#ccc" />
          <Text style={{ color: "#ccc", fontSize: 12 }}>
            {formaterDate(item.date)}
          </Text>
        </View>
      </View>
    );
  }

  function renduFiltres(categories: string[]) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 8 }}>
          Filtrer par catégorie
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity
            style={{
              backgroundColor:
                filtreCategorie === null
                  ? couleur.dore
                  : couleur.marineTransparent,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: couleur.dore,
            }}
            onPress={function () {
              setFiltreCategorie(null);
            }}
          >
            <Text
              style={{
                color:
                  filtreCategorie === null ? couleur.marine : couleur.blanc,
                fontSize: 12,
                fontWeight: "bold",
              }}
            >
              Tous
            </Text>
          </TouchableOpacity>

          {categories.map(function (cat) {
            return (
              <TouchableOpacity
                key={cat}
                style={{
                  backgroundColor:
                    filtreCategorie === cat
                      ? couleur.dore
                      : couleur.marineTransparent,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: couleur.dore,
                }}
                onPress={function () {
                  setFiltreCategorie(cat);
                }}
              >
                <Text
                  style={{
                    color:
                      filtreCategorie === cat ? couleur.marine : couleur.blanc,
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  if (chargement) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  const depotsFiltres = filtrerDepots();
  const categories = obtenirCategories();

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 20 }}>
      <Text style={stylesTitre.sousTitre}>Historique des dépôts</Text>

      {categories.length > 0 && renduFiltres(categories)}

      {depotsFiltres.length > 0 ? (
        <FlatList
          data={depotsFiltres}
          renderItem={function (props) {
            return renduItemDepot(props.item);
          }}
          keyExtractor={function (item) {
            return item.id;
          }}
          scrollEnabled={false}
        />
      ) : (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Ionicons name="document-outline" size={48} color={couleur.dore} />
          <Text
            style={{
              color: couleur.blanc,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Aucun dépôt enregistré
          </Text>
        </View>
      )}
    </View>
  );
}