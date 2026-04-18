import { Ionicons } from "@expo/vector-icons";
import {
    Timestamp,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    VictoryAxis,
    VictoryBar,
    VictoryChart,
    VictoryLine,
    VictoryScatter,
} from "victory-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { db } from "../../firebaseConfig";

const { width } = Dimensions.get("window");

type VueStatistique =
  | "depots"
  | "semaines"
  | "contrats"
  | "gains"
  | "responsables";

type DonneeGraphique = { x: string; y: number };

type Etablissement = {
  id: string;
  nom: string;
  ville: string;
  montantContrat: number;
  dateRenouvellement?: Date | null;
};

type Responsable = {
  id: string;
  nom: string;
  pointsDepot: number;
  depotsToday: number;
  moyenneDay: number;
  multiplicateur: number;
  alerteLocale: boolean;
};

type Quartier = {
  nom: string;
  ville: string;
};

const SEUIL_MINIMAL = 25000;

const donneesDepotsVides: DonneeGraphique[] = [
  { x: "7h-10h", y: 0 },
  { x: "10h-13h", y: 0 },
  { x: "13h-16h", y: 0 },
  { x: "16h-19h", y: 0 },
  { x: "19h-22h", y: 0 },
];

const donneesSemainesVides: DonneeGraphique[] = [
  { x: "Sem 1", y: 0 },
  { x: "Sem 2", y: 0 },
  { x: "Sem 3", y: 0 },
  { x: "Sem 4", y: 0 },
];

const moisLibelles = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function formaterMontant(montant: number): string {
  return montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function convertirEnDate(valeur: any): Date | null {
  if (!valeur) return null;

  if (typeof valeur.toDate === "function") {
    return valeur.toDate();
  }

  if (valeur instanceof Date) {
    return valeur;
  }

  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

function lireNombre(...valeurs: any[]): number {
  for (const valeur of valeurs) {
    if (typeof valeur === "number" && Number.isFinite(valeur)) {
      return valeur;
    }
    if (typeof valeur === "string") {
      const nombre = Number(valeur);
      if (Number.isFinite(nombre)) {
        return nombre;
      }
    }
  }
  return 0;
}

function formaterDateCourte(date?: Date | null): string {
  if (!date) return "Non définie";
  return date.toLocaleDateString("fr-FR");
}

export default function OngletStatistiques() {
  const [vueActive, setVueActive] = useState<VueStatistique>("depots");
  const [chargement, setChargement] = useState(true);

  const [donneesDepots, setDonneesDepots] =
    useState<DonneeGraphique[]>(donneesDepotsVides);
  const [totalDepots, setTotalDepots] = useState(0);

  const [donneesSemaines, setDonneesSemaines] =
    useState<DonneeGraphique[]>(donneesSemainesVides);

  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [partenaireOuvert, setPartenaireOuvert] = useState<string | null>(null);
  const [donneesContrats, setDonneesContrats] = useState<{
    [key: string]: DonneeGraphique[];
  }>({});

  const [responsables, setResponsables] = useState<Responsable[]>([]);

  const [villes, setVilles] = useState<string[]>([]);
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [villeSelectionnee, setVilleSelectionnee] = useState("Bafoussam");
  const [menuVilleOuvert, setMenuVilleOuvert] = useState(false);

  useEffect(function () {
    chargerTout();
  }, []);

  const gainsMois = useMemo(
    function () {
      let total = 0;

      for (const etablissement of etablissements) {
        total += etablissement.montantContrat;
      }

      return total;
    },
    [etablissements],
  );

  const variation = useMemo(
    function () {
      const maintenant = new Date();
      const moisActuel = maintenant.getMonth();
      const moisPrecedent = moisActuel === 0 ? 11 : moisActuel - 1;

      let totalMoisActuel = 0;
      let totalMoisPrecedent = 0;

      for (const etablissement of etablissements) {
        const moisRenouvellement = etablissement.dateRenouvellement?.getMonth();

        if (moisRenouvellement === moisActuel) {
          totalMoisActuel += etablissement.montantContrat;
        } else if (moisRenouvellement === moisPrecedent) {
          totalMoisPrecedent += etablissement.montantContrat;
        }
      }

      if (totalMoisPrecedent === 0) {
        return totalMoisActuel > 0 ? 100 : 0;
      }

      return Math.round(
        ((totalMoisActuel - totalMoisPrecedent) / totalMoisPrecedent) * 100,
      );
    },
    [etablissements],
  );

  const donneesTendanceGains = useMemo(
    function () {
      const maintenant = new Date();
      const donnees: DonneeGraphique[] = [];

      for (let i = 5; i >= 0; i--) {
        const dateCible = new Date(
          maintenant.getFullYear(),
          maintenant.getMonth() - i,
          1,
        );
        let total = 0;

        for (const etablissement of etablissements) {
          const dateRenouvellement = etablissement.dateRenouvellement;
          if (
            dateRenouvellement &&
            dateRenouvellement.getFullYear() === dateCible.getFullYear() &&
            dateRenouvellement.getMonth() === dateCible.getMonth()
          ) {
            total += etablissement.montantContrat;
          }
        }

        donnees.push({
          x: moisLibelles[dateCible.getMonth()],
          y: total,
        });
      }

      const auMoinsUneValeur = donnees.some(function (item) {
        return item.y > 0;
      });

      if (auMoinsUneValeur) {
        return donnees;
      }

      return [
        {
          x: moisLibelles[maintenant.getMonth()],
          y: gainsMois,
        },
      ];
    },
    [etablissements, gainsMois],
  );

  async function chargerTout() {
    setChargement(true);

    try {
      await Promise.all([
        chargerConfiguration(),
        chargerDepots(),
        chargerSemaines(),
        chargerEtablissements(),
        chargerResponsables(),
      ]);
    } catch (e: any) {
      console.log("Erreur chargement stats:", e?.message || e);
    } finally {
      setChargement(false);
    }
  }

  async function chargerConfiguration() {
    try {
      const snapshot = await getDoc(doc(db, "configuration", "zones"));

      if (snapshot.exists()) {
        const data = snapshot.data();
        const villesRecues = Array.isArray(data.villes) ? data.villes : [];
        const quartiersRecus = Array.isArray(data.quartiers)
          ? data.quartiers
          : [];

        setVilles(villesRecues);
        setQuartiers(quartiersRecus);

        if (
          villesRecues.length > 0 &&
          !villesRecues.includes(villeSelectionnee)
        ) {
          setVilleSelectionnee(villesRecues[0]);
        }
      }
    } catch (e) {
      console.error("Erreur configuration:", e);
    }
  }

  async function chargerDepots() {
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);

    const finJour = new Date();
    finJour.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "depots"),
      where("date", ">=", Timestamp.fromDate(debutJour)),
      where("date", "<=", Timestamp.fromDate(finJour)),
      orderBy("date"),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setDonneesDepots(donneesDepotsVides);
      setTotalDepots(0);
      return;
    }

    const tranches = [0, 0, 0, 0, 0];

    snapshot.docs.forEach(function (documentDepot) {
      const dateDepot = convertirEnDate(documentDepot.data().date);

      if (!dateDepot) {
        return;
      }

      const heure = dateDepot.getHours();

      if (heure >= 7 && heure < 10) {
        tranches[0] += 1;
      } else if (heure >= 10 && heure < 13) {
        tranches[1] += 1;
      } else if (heure >= 13 && heure < 16) {
        tranches[2] += 1;
      } else if (heure >= 16 && heure < 19) {
        tranches[3] += 1;
      } else if (heure >= 19 && heure < 22) {
        tranches[4] += 1;
      }
    });

    const labels = ["7h-10h", "10h-13h", "13h-16h", "16h-19h", "19h-22h"];
    const dataDepots = labels.map(function (label, index) {
      return { x: label, y: tranches[index] };
    });

    setDonneesDepots(dataDepots);
    setTotalDepots(snapshot.size);
  }

  async function chargerSemaines() {
    const maintenant = new Date();
    const debutMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      1,
    );
    const finMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const q = query(
      collection(db, "depots"),
      where("date", ">=", Timestamp.fromDate(debutMois)),
      where("date", "<=", Timestamp.fromDate(finMois)),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setDonneesSemaines(donneesSemainesVides);
      return;
    }

    const semaines: Set<string>[] = [
      new Set(),
      new Set(),
      new Set(),
      new Set(),
    ];

    snapshot.docs.forEach(function (documentDepot) {
      const dataDepot = documentDepot.data();
      const dateDepot = convertirEnDate(dataDepot.date);
      const citoyenId = dataDepot.id_citoyen || documentDepot.id;

      if (!dateDepot) {
        return;
      }

      const jour = dateDepot.getDate();

      if (jour <= 7) {
        semaines[0].add(citoyenId);
      } else if (jour <= 14) {
        semaines[1].add(citoyenId);
      } else if (jour <= 21) {
        semaines[2].add(citoyenId);
      } else {
        semaines[3].add(citoyenId);
      }
    });

    setDonneesSemaines(
      semaines.map(function (semaine, index) {
        return { x: `Sem ${index + 1}`, y: semaine.size };
      }),
    );
  }

  async function chargerEtablissements() {
    try {
      const snapshot = await getDocs(collection(db, "etablissements"));

      const liste: Etablissement[] = [];
      const donneesMap: { [key: string]: DonneeGraphique[] } = {};

      snapshot.docs.forEach(function (documentEtablissement) {
        const data = documentEtablissement.data();
        const montantContrat = lireNombre(data.montantContrat, 25000);
        const dateRenouvellement = convertirEnDate(data.dateRenouvellement);

        const etablissement: Etablissement = {
          id: documentEtablissement.id,
          nom: data.nom || data.NomEntreprise || "Établissement",
          ville: data.ville || "",
          montantContrat,
          dateRenouvellement,
        };

        liste.push(etablissement);

        donneesMap[documentEtablissement.id] = [
          {
            x: dateRenouvellement
              ? moisLibelles[dateRenouvellement.getMonth()]
              : "Actuel",
            y: montantContrat,
          },
        ];
      });

      setEtablissements(liste);
      setDonneesContrats(donneesMap);
    } catch (e) {
      console.error("Erreur établissements:", e);
      setEtablissements([]);
      setDonneesContrats({});
    }
  }

  async function chargerResponsables() {
    try {
      const snapshotRespo = await getDocs(collection(db, "RespoID"));
      const listeRespo: Responsable[] = [];

      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);

      const finJour = new Date();
      finJour.setHours(23, 59, 59, 999);

      for (const documentRespo of snapshotRespo.docs) {
        const dataRespo = documentRespo.data();
        const respoId = documentRespo.id;

        let depotsToday = 0;

        try {
          const qDepots = query(
            collection(db, "depots"),
            where("date", ">=", Timestamp.fromDate(debutJour)),
            where("date", "<=", Timestamp.fromDate(finJour)),
            where("respoID", "==", respoId),
          );
          const snapshotDepots = await getDocs(qDepots);
          depotsToday = snapshotDepots.size;
        } catch (erreurRespoId) {
          try {
            const qDepotsAlternatif = query(
              collection(db, "depots"),
              where("date", ">=", Timestamp.fromDate(debutJour)),
              where("date", "<=", Timestamp.fromDate(finJour)),
              where("id_agent", "==", respoId),
            );
            const snapshotDepotsAlternatif = await getDocs(qDepotsAlternatif);
            depotsToday = snapshotDepotsAlternatif.size;
          } catch (erreurIdAgent) {
            console.log(
              "Impossible de lire les dépôts du responsable:",
              respoId,
              erreurRespoId || erreurIdAgent,
            );
          }
        }

        const pointsDepot = lireNombre(
          dataRespo.pointsDepot,
          dataRespo.point_depot,
          dataRespo.points_depot,
        );

        const moyenneDay = Math.max(1, Math.round(pointsDepot / 100));
        const multiplicateur =
          moyenneDay > 0 ? Number((depotsToday / moyenneDay).toFixed(2)) : 0;
        const alerteLocale = multiplicateur >= 3 && depotsToday > 0;

        listeRespo.push({
          id: respoId,
          nom: dataRespo.nom || "Responsable inconnu",
          pointsDepot,
          depotsToday,
          moyenneDay,
          multiplicateur,
          alerteLocale,
        });
      }

      listeRespo.sort(function (a, b) {
        return b.depotsToday - a.depotsToday;
      });

      setResponsables(listeRespo);
    } catch (e) {
      console.error("Erreur responsables:", e);
      setResponsables([]);
    }
  }

  function togglePartenaire(id: string) {
    setPartenaireOuvert(partenaireOuvert === id ? null : id);
  }

  function CarteQuartiers() {
    const quartiersVille = quartiers.filter(function (quartier) {
      return quartier.ville === villeSelectionnee;
    });

    return (
      <View
        style={{
          backgroundColor: couleur.marineTransparent,
          borderRadius: 20,
          padding: 16,
          marginBottom: 25,
          borderWidth: 2,
          borderColor: couleur.dore,
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
          <Text
            style={{
              color: couleur.doreClair,
              fontWeight: "bold",
              fontSize: 18,
            }}
          >
            Carte des quartiers
          </Text>

          <TouchableOpacity
            onPress={() => setMenuVilleOuvert(!menuVilleOuvert)}
            style={{
              backgroundColor: couleur.marine,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: couleur.dore,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text style={{ color: couleur.doreClair, fontWeight: "600" }}>
              {villeSelectionnee}
            </Text>
            <Ionicons
              name={menuVilleOuvert ? "chevron-up" : "chevron-down"}
              size={18}
              color={couleur.doreClair}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        </View>

        {menuVilleOuvert && (
          <View
            style={{
              backgroundColor: couleur.marine,
              borderRadius: 12,
              padding: 8,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: couleur.dore,
            }}
          >
            {villes.length === 0 ? (
              <Text style={{ color: "#ccc", padding: 8 }}>
                Aucune ville disponible
              </Text>
            ) : (
              villes.map(function (ville) {
                return (
                  <TouchableOpacity
                    key={ville}
                    onPress={() => {
                      setVilleSelectionnee(ville);
                      setMenuVilleOuvert(false);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor:
                        ville === villeSelectionnee
                          ? couleur.dore
                          : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color:
                          ville === villeSelectionnee
                            ? couleur.marine
                            : couleur.doreClair,
                        fontWeight:
                          ville === villeSelectionnee ? "bold" : "normal",
                      }}
                    >
                      {ville}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <Text
          style={{
            color: couleur.doreClair,
            fontWeight: "bold",
            fontSize: 16,
            marginBottom: 12,
          }}
        >
          Quartiers de {villeSelectionnee}
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "center",
          }}
        >
          {quartiersVille.length === 0 ? (
            <Text style={{ color: "#ccc", textAlign: "center", padding: 20 }}>
              Aucun quartier trouvé pour {villeSelectionnee}
            </Text>
          ) : (
            quartiersVille.map(function (quartier) {
              return <QuartierItem key={quartier.nom} quartier={quartier} />;
            })
          )}
        </View>
      </View>
    );
  }

  function QuartierItem({ quartier }: { quartier: Quartier }) {
    const [iconeCote, setIconeCote] = useState("🔴");
    const [score, setScore] = useState(0);

    useEffect(() => {
      async function loadCote() {
        try {
          const snap = await getDoc(doc(db, "cote", quartier.nom));

          if (snap.exists()) {
            const scoreTotal = lireNombre(snap.data().score_total, 0);
            setScore(scoreTotal);
            setIconeCote(
              scoreTotal >= 80 ? "🟢" : scoreTotal >= 40 ? "🟠" : "🔴",
            );
          }
        } catch (e) {
          console.error(e);
        }
      }

      loadCote();
    }, [quartier.nom]);

    return (
      <TouchableOpacity
        style={{
          width: width * 0.2,
          backgroundColor: couleur.marine,
          paddingVertical: 18,
          paddingHorizontal: 4,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: couleur.dore,
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              color: couleur.doreClair,
              fontSize: 17,
              fontWeight: "bold",
            }}
          >
            {quartier.nom}
          </Text>
          <Text
            style={{
              color: couleur.doreClair,
              fontSize: 17,
              fontWeight: "bold",
              marginLeft: 6,
            }}
          >
            : {score}
          </Text>
        </View>
        <Text style={{ color: "#ccc", marginTop: 8, fontSize: 26 }}>
          {iconeCote}
        </Text>
      </TouchableOpacity>
    );
  }

  if (chargement) {
    return (
      <ActivityIndicator
        size="large"
        color={couleur.dore}
        style={{ marginTop: "30%" }}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ flex: 1 }}>
        <Text style={stylesTitre.titre}>Statistiques</Text>

        <CarteQuartiers />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(201,168,76,0.3)",
            backgroundColor: "rgba(41,79,120,0.3)",
          }}
        >
          {[
            { id: "depots", icone: "bar-chart", label: "Dépôts" },
            { id: "semaines", icone: "calendar", label: "Semaines" },
            { id: "contrats", icone: "storefront", label: "Contrats" },
            { id: "gains", icone: "trending-up", label: "Gains" },
            {
              id: "responsables",
              icone: "people",
              label: "Responsables",
            },
          ].map(function (vue) {
            const actif = vueActive === vue.id;

            return (
              <TouchableOpacity
                key={vue.id}
                style={{ alignItems: "center", paddingHorizontal: 8 }}
                onPress={() => setVueActive(vue.id as VueStatistique)}
              >
                <Ionicons
                  name={(actif ? vue.icone : `${vue.icone}-outline`) as any}
                  size={22}
                  color={actif ? couleur.dore : "#ccc"}
                />
                <Text
                  style={{
                    fontSize: 9,
                    color: actif ? couleur.dore : "#ccc",
                    marginTop: 3,
                    fontWeight: actif ? "bold" : "normal",
                  }}
                >
                  {vue.label}
                </Text>
                {actif && (
                  <View
                    style={{
                      width: 20,
                      height: 2,
                      backgroundColor: couleur.dore,
                      borderRadius: 1,
                      marginTop: 3,
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {vueActive === "depots" && (
          <>
            <View>
              <Text style={stylesTitre.titre}>Dépôts par heure</Text>
              <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 15 }}>
                Aujourd'hui — se réinitialise à minuit
              </Text>

              <View
                style={{
                  backgroundColor: couleur.marineTransparent,
                  borderRadius: 15,
                  padding: 10,
                  marginBottom: 15,
                  borderWidth: 1,
                  borderColor: "rgba(201,168,76,0.3)",
                }}
              >
                <VictoryChart
                  height={240}
                  padding={{ top: 20, bottom: 65, left: 50, right: 20 }}
                  domainPadding={{ x: [10, 10] }}
                >
                  <VictoryAxis
                    tickValues={donneesDepots.map(function (item) {
                      return item.x;
                    })}
                    style={{
                      axis: { stroke: "#ccc" },
                      tickLabels: {
                        fill: "#ccc",
                        fontSize: 10,
                        angle: -45,
                        textAnchor: "end",
                      },
                    }}
                  />
                  <VictoryAxis
                    dependentAxis
                    tickCount={6}
                    style={{
                      axis: { stroke: "#ccc" },
                      tickLabels: { fill: "#ccc", fontSize: 10 },
                    }}
                  />
                  <VictoryBar
                    data={donneesDepots}
                    barWidth={35}
                    style={{ data: { fill: couleur.dore } }}
                    cornerRadius={{ top: 4 }}
                  />
                </VictoryChart>
              </View>
            </View>

            <View
              style={{
                backgroundColor: couleur.marineTransparent,
                borderRadius: 12,
                padding: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "rgba(201,168,76,0.3)",
              }}
            >
              <Text style={{ color: "#ccc", fontSize: 13 }}>Total du jour</Text>
              <Text
                style={{
                  color: couleur.dore,
                  fontSize: 28,
                  fontWeight: "bold",
                  marginTop: 4,
                }}
              >
                {totalDepots}
              </Text>
              <Text style={{ color: "#ccc", fontSize: 11 }}>dépôts</Text>
            </View>
          </>
        )}

        {vueActive === "semaines" && (
          <View>
            <Text style={stylesTitre.titre}>Citoyens actifs</Text>
            <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 15 }}>
              {new Date().toLocaleString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </Text>

            <View
              style={{
                backgroundColor: couleur.marineTransparent,
                borderRadius: 15,
                padding: 10,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: "rgba(201,168,76,0.3)",
              }}
            >
              <VictoryChart
                height={240}
                padding={{ top: 20, bottom: 50, left: 50, right: 20 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: "#ccc" },
                    tickLabels: { fill: "#ccc", fontSize: 11 },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: "#ccc" },
                    tickLabels: { fill: "#ccc", fontSize: 10 },
                  }}
                />
                <VictoryBar
                  data={donneesSemaines}
                  style={{ data: { fill: couleur.turquoise } }}
                  cornerRadius={{ top: 4 }}
                />
              </VictoryChart>
            </View>

            <Text style={{ color: "#ccc", fontSize: 11, textAlign: "center" }}>
              Citoyens uniques ayant effectué au moins 1 dépôt par semaine
            </Text>
          </View>
        )}

        {vueActive === "contrats" && (
          <View>
            <Text style={stylesTitre.titre}>Contrats partenaires</Text>

            <View
              style={{
                backgroundColor: couleur.marineTransparent,
                borderRadius: 10,
                padding: 12,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: couleur.dore,
                alignItems: "center",
              }}
            >
              <Text style={{ color: couleur.dore, fontWeight: "bold" }}>
                Seuil minimal : {formaterMontant(SEUIL_MINIMAL)}
              </Text>
            </View>

            {etablissements.length === 0 ? (
              <Text
                style={{ color: "#ccc", textAlign: "center", marginTop: 20 }}
              >
                Aucun établissement disponible
              </Text>
            ) : (
              etablissements.map(function (etablissement) {
                const estOuvert = partenaireOuvert === etablissement.id;

                return (
                  <View key={etablissement.id} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: couleur.marineTransparent,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: estOuvert
                          ? couleur.dore
                          : "rgba(201,168,76,0.3)",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onPress={() => togglePartenaire(etablissement.id)}
                    >
                      <View>
                        <Text
                          style={{
                            color: couleur.blanc,
                            fontWeight: "bold",
                            fontSize: 14,
                          }}
                        >
                          {etablissement.nom}
                        </Text>
                        <Text style={{ color: "#ccc", fontSize: 11 }}>
                          {etablissement.ville || "Ville non définie"}
                        </Text>
                      </View>
                      <Ionicons
                        name={estOuvert ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={couleur.dore}
                      />
                    </TouchableOpacity>

                    {estOuvert && donneesContrats[etablissement.id] && (
                      <View
                        style={{
                          backgroundColor: "rgba(41,79,120,0.5)",
                          borderRadius: 12,
                          marginTop: 4,
                          padding: 10,
                          borderWidth: 1,
                          borderColor: "rgba(201,168,76,0.3)",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 10,
                          }}
                        >
                          <Text style={{ color: couleur.blanc, fontSize: 13 }}>
                            Montant actuel :{" "}
                            <Text
                              style={{
                                color: couleur.dore,
                                fontWeight: "bold",
                              }}
                            >
                              {formaterMontant(etablissement.montantContrat)}
                            </Text>
                          </Text>
                          <Text
                            style={{
                              color: "#ccc",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Renouvellement :{" "}
                            {formaterDateCourte(
                              etablissement.dateRenouvellement,
                            )}
                          </Text>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={true}
                        >
                          <VictoryChart
                            width={360}
                            height={200}
                            padding={{
                              top: 20,
                              bottom: 50,
                              left: 60,
                              right: 20,
                            }}
                            domainPadding={{ x: [40, 40] }}
                          >
                            <VictoryAxis
                              style={{
                                axis: { stroke: "#ccc" },
                                tickLabels: {
                                  fill: "#ccc",
                                  fontSize: 10,
                                },
                              }}
                            />
                            <VictoryAxis
                              dependentAxis
                              tickFormat={(t) => `${Math.round(t / 1000)}k`}
                              style={{
                                axis: { stroke: "#ccc" },
                                tickLabels: { fill: "#ccc", fontSize: 9 },
                              }}
                            />
                            <VictoryBar
                              data={donneesContrats[etablissement.id]}
                              style={{ data: { fill: couleur.dore } }}
                              cornerRadius={{ top: 3 }}
                            />
                          </VictoryChart>
                        </ScrollView>
                        <Text
                          style={{
                            color: "#ccc",
                            fontSize: 10,
                            textAlign: "center",
                            marginTop: 4,
                          }}
                        >
                          Montant réel lu depuis la collection établissements
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {vueActive === "gains" && (
          <View>
            <Text style={stylesTitre.titre}>Gains Hyzakam</Text>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: couleur.marineTransparent,
                  borderRadius: 15,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: couleur.dore,
                  alignItems: "center",
                }}
              >
                <Ionicons name="cash-outline" size={26} color={couleur.dore} />
                <Text
                  style={{
                    color: couleur.blanc,
                    fontSize: 14,
                    fontWeight: "bold",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {formaterMontant(gainsMois)}
                </Text>
                <Text style={{ color: "#ccc", fontSize: 11, marginTop: 4 }}>
                  Total des contrats
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: couleur.marineTransparent,
                  borderRadius: 15,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: couleur.turquoise,
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={
                    variation >= 0
                      ? "trending-up-outline"
                      : "trending-down-outline"
                  }
                  size={26}
                  color={
                    variation >= 0 ? couleur.turquoise : couleur.erreurClair
                  }
                />
                <Text
                  style={{
                    color:
                      variation >= 0 ? couleur.turquoise : couleur.erreurClair,
                    fontSize: 22,
                    fontWeight: "bold",
                    marginTop: 8,
                  }}
                >
                  {variation >= 0 ? "+" : ""}
                  {variation}%
                </Text>
                <Text style={{ color: "#ccc", fontSize: 11, marginTop: 4 }}>
                  selon dates de renouvellement
                </Text>
              </View>
            </View>

            {etablissements.filter(function (item) {
              return item.montantContrat < SEUIL_MINIMAL;
            }).length > 0 ? (
              <View
                style={{
                  backgroundColor: "rgba(94,41,35,0.6)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: couleur.erreur,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Ionicons
                  name="warning-outline"
                  size={22}
                  color={couleur.erreurClair}
                />
                <Text style={{ color: couleur.blanc, flex: 1 }}>
                  ⚠️{" "}
                  {
                    etablissements.filter(function (item) {
                      return item.montantContrat < SEUIL_MINIMAL;
                    }).length
                  }{" "}
                  établissement(s) sous le seuil de 25 000 FCFA
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: "rgba(45,106,79,0.3)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: couleur.vert,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color={couleur.turquoise}
                />
                <Text style={{ color: couleur.turquoise }}>
                  ✅ Tous les contrats respectent le seuil minimal
                </Text>
              </View>
            )}

            <Text style={stylesTitre.sousTitre}>Tendance des gains</Text>
            <View
              style={{
                backgroundColor: couleur.marineTransparent,
                borderRadius: 15,
                padding: 10,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: "rgba(201,168,76,0.3)",
              }}
            >
              <VictoryChart
                height={220}
                padding={{ top: 20, bottom: 50, left: 70, right: 20 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: "#ccc" },
                    tickLabels: { fill: "#ccc", fontSize: 11 },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(t) => `${Math.round(t / 1000)}k`}
                  style={{
                    axis: { stroke: "#ccc" },
                    tickLabels: { fill: "#ccc", fontSize: 10 },
                  }}
                />
                <VictoryLine
                  data={donneesTendanceGains}
                  style={{ data: { stroke: couleur.dore, strokeWidth: 2.5 } }}
                />
                <VictoryScatter
                  data={donneesTendanceGains}
                  size={5}
                  style={{ data: { fill: couleur.doreClair } }}
                />
              </VictoryChart>
              <Text
                style={{ color: "#ccc", fontSize: 10, textAlign: "center" }}
              >
                6 derniers mois à partir des dates de renouvellement disponibles
              </Text>
            </View>

            <Text style={stylesTitre.sousTitre}>Détail des contrats</Text>
            {etablissements.map(function (etablissement) {
              const sousLeSeuil = etablissement.montantContrat < SEUIL_MINIMAL;

              return (
                <View
                  key={etablissement.id}
                  style={{
                    backgroundColor: couleur.marineTransparent,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: sousLeSeuil
                      ? couleur.erreur
                      : "rgba(201,168,76,0.3)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: sousLeSeuil
                        ? couleur.erreurClair
                        : couleur.vert,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: couleur.blanc,
                        fontWeight: "bold",
                        fontSize: 14,
                      }}
                    >
                      {etablissement.nom}
                    </Text>
                    <Text style={{ color: "#ccc", fontSize: 11 }}>
                      {etablissement.ville || "Ville non définie"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: sousLeSeuil ? couleur.erreurClair : couleur.dore,
                      fontWeight: "bold",
                      fontSize: 13,
                    }}
                  >
                    {formaterMontant(etablissement.montantContrat)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {vueActive === "responsables" && (
          <View>
            <Text style={stylesTitre.titre}>Responsables</Text>
            <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 15 }}>
              Métriques locales calculées à partir de RespoID et des dépôts du
              jour
            </Text>

            <View
              style={{
                backgroundColor: couleur.marineTransparent,
                borderRadius: 15,
                padding: 10,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: "rgba(201,168,76,0.3)",
              }}
            >
              <VictoryChart
                height={240}
                padding={{ top: 20, bottom: 55, left: 50, right: 20 }}
                domainPadding={{ x: 20 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: "#ccc" },
                    tickLabels: { fill: "#ccc", fontSize: 9, angle: -20 },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: "#ccc" },
                    tickLabels: { fill: "#ccc", fontSize: 10 },
                  }}
                />
                <VictoryBar
                  data={responsables.map(function (item) {
                    return {
                      x:
                        item.nom.length > 8
                          ? `${item.nom.slice(0, 8)}...`
                          : item.nom,
                      y: item.depotsToday,
                    };
                  })}
                  style={{ data: { fill: couleur.turquoise } }}
                  cornerRadius={{ top: 4 }}
                />
              </VictoryChart>
            </View>

            {responsables.length === 0 ? (
              <Text style={{ color: "#ccc", textAlign: "center" }}>
                Aucun responsable disponible
              </Text>
            ) : (
              responsables.map(function (responsable) {
                return (
                  <View
                    key={responsable.id}
                    style={{
                      backgroundColor: couleur.marineTransparent,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: responsable.alerteLocale
                        ? couleur.erreur
                        : "rgba(201,168,76,0.3)",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: couleur.blanc,
                          fontWeight: "bold",
                          fontSize: 14,
                          flex: 1,
                        }}
                      >
                        {responsable.nom}
                      </Text>

                      <View
                        style={{
                          backgroundColor: responsable.alerteLocale
                            ? "rgba(190,60,60,0.2)"
                            : "rgba(45,106,79,0.25)",
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 20,
                        }}
                      >
                        <Text
                          style={{
                            color: responsable.alerteLocale
                              ? couleur.erreurClair
                              : couleur.turquoise,
                            fontSize: 11,
                            fontWeight: "bold",
                          }}
                        >
                          {responsable.alerteLocale ? "Surveillance" : "Normal"}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: "#ccc", fontSize: 12 }}>
                      Dépôts du jour :{" "}
                      <Text style={{ color: couleur.dore }}>
                        {responsable.depotsToday}
                      </Text>
                    </Text>
                    <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
                      Moyenne locale estimée :{" "}
                      <Text style={{ color: couleur.dore }}>
                        {responsable.moyenneDay}
                      </Text>
                    </Text>
                    <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
                      Points dépôt :{" "}
                      <Text style={{ color: couleur.dore }}>
                        {responsable.pointsDepot}
                      </Text>
                    </Text>
                    <Text style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
                      Multiplicateur du jour :{" "}
                      <Text
                        style={{
                          color: responsable.alerteLocale
                            ? couleur.erreurClair
                            : couleur.turquoise,
                        }}
                      >
                        x{responsable.multiplicateur}
                      </Text>
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
        <View style={{ height: 30 }} />
      </View>
    </ScrollView>
  );
}
