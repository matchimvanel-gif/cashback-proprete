import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView,Dimensions, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { VictoryBar, VictoryChart, VictoryAxis, VictoryLine, VictoryScatter } from 'victory-native'
import { collection, getDocs,getDoc,doc, query, where, Timestamp,orderBy } from 'firebase/firestore'
import { db } from '../../firebaseConfig'
import { couleur, stylesTitre } from '../../constants/animation'

const { width } = Dimensions.get('window')

type DonneeGraphique = { x: string, y: number }
type Partenaire = { id: string, NomEntreprise: string, ville: string }
type ContratPartenaire = { id: string, NomEntreprise: string, ville: string, montant: number }

const SEUIL_MINIMAL = 25000

const donneeDepotsFictives: DonneeGraphique[] = [
    { x: '0',  y: 0 },
    { x: '7h',  y: 12 },
    { x: '10h', y: 28 },
    { x: '13h', y: 19 },
    { x: '16h', y: 35 },
    { x: '19h', y: 8  },
    { x: '22h', y: 10  },
]

const donneeSemainesFictives: DonneeGraphique[] = [
    { x: '0', y: 0 },
    { x: 'Sem 1', y: 45 },
    { x: 'Sem 2', y: 62 },
    { x: 'Sem 3', y: 38 },
    { x: 'Sem 4', y: 71 },
]

const donneesTendanceFictives: DonneeGraphique[] = [
    { x: 'Oct', y: 45000 },
    { x: 'Nov', y: 52000 },
    { x: 'Déc', y: 48000 },
    { x: 'Jan', y: 61000 },
    { x: 'Fév', y: 55000 },
    { x: 'Mar', y: 70000 },
]

const mois = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function genererDonneesContrat(): DonneeGraphique[] {
    return mois.map(function(m) {
        return { x: m, y: Math.floor(Math.random() * (80000 - 25000 + 1)) + 25000 }
    })
}

function formaterMontant(montant: number): string {
    return montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
}

export default function OngletStatistiques() {

    const [vueActive, setVueActive] = useState<'depots' | 'semaines' | 'contrats' | 'gains'>('depots')
    const [chargement, setChargement] = useState(true)

    // Vue dépôts
    const [donneesDepots, setDonneesDepots] = useState<DonneeGraphique[]>(donneeDepotsFictives)
    const [totalDepots, setTotalDepots] = useState(0)

    // Vue semaines
    const [donneesSemaines, setDonneesSemaines] = useState<DonneeGraphique[]>(donneeSemainesFictives)

    // Vue contrats
    const [partenaires, setPartenaires] = useState<Partenaire[]>([])
    const [partenaireOuvert, setPartenaireOuvert] = useState<string | null>(null)
    const [donneesContrats, setDonneesContrats] = useState<{[key: string]: DonneeGraphique[]}>({})

    // Vue gains
    const [contrats, setContrats] = useState<ContratPartenaire[]>([])
    const [gainsMois, setGainsMois] = useState(0)
    const [variation, setVariation] = useState(0)

    const [villes, setVilles] = useState<string[]>([]);
    const [quartiers, setQuartiers] = useState<{ nom: string; ville: string }[]>([]);
    const [villeSelectionnee, setVilleSelectionnee] = useState('Bafoussam');
    const [menuVilleOuvert,setMenuVilleOuvert]=useState(false)

    useEffect(function() {
        chargerTout()
    }, [])

    async function chargerTout() {
        setChargement(true)
        try {
            await Promise.all([
                chargerConfiguration(),
                chargerDepots(),
                chargerSemaines(),
                chargerPartenairesEtGains(),
            ])
        } catch (e: any) {
            console.log('Erreur chargement stats:', e.message)
        } finally {
            setChargement(false)
        }
    }

    // 1. Charger la configuration (villes + quartiers)
        async function chargerConfiguration() {
            try {
                const snapshot = await getDoc(doc(db, 'configuration', 'zones'));
                if (snapshot.exists()) {
                    setVilles(snapshot.data().villes || []);
                    setQuartiers(snapshot.data().quartiers || []);
                }
            } catch (e) {
                console.error('Erreur configuration:', e);
            }
        }

    async function chargerDepots() {
        const debutJour = new Date()
        debutJour.setHours(0, 0, 0, 0)
        const finJour = new Date()
        finJour.setHours(23, 59, 59, 999)

        const q = query(
            collection(db, 'depots'),
            where('date', '>=', Timestamp.fromDate(debutJour)),
            where('date', '<=', Timestamp.fromDate(finJour)),
            orderBy('date')
        )
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
            setDonneesDepots(donneeDepotsFictives)
            setTotalDepots(donneeDepotsFictives.reduce(function(a, b) { return a + b.y }, 0))
            return
        }

        const tranches = [0, 0, 0, 0, 0]
        snapshot.docs.forEach(function(d) {
            const date = d.data().date?.toDate()
            if (!date) return
            const heure = date.getHours()
            if (heure >= 7  && heure < 10) tranches[0]++
            else if (heure >= 10 && heure < 13) tranches[1]++
            else if (heure >= 13 && heure < 16) tranches[2]++
            else if (heure >= 16 && heure < 19) tranches[3]++
            else if (heure >= 19 && heure < 22) tranches[4]++
        })

        const labels = ['7h-10h', '10h-13h', '13h-16h', '16h-19h', '19h-22h']
        setDonneesDepots(labels.map(function(label, i) {
            return { x: label, y: tranches[i] }
        }))
        setTotalDepots(snapshot.size)
    }

    async function chargerSemaines() {
        const maintenant = new Date()
        const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
        const finMois = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0, 23, 59, 59)

        const q = query(
            collection(db, 'depots'),
            where('date', '>=', Timestamp.fromDate(debutMois)),
            where('date', '<=', Timestamp.fromDate(finMois))
        )
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
            setDonneesSemaines(donneeSemainesFictives)
            return
        }

        const semaines: Set<string>[] = [new Set(), new Set(), new Set(), new Set()]
        snapshot.docs.forEach(function(d) {
            const date = d.data().date?.toDate()
            if (!date) return
            const jour = date.getDate()
            const citoyen = d.data().id_citoyen || ''
            if (jour <= 7)       semaines[0].add(citoyen)
            else if (jour <= 14) semaines[1].add(citoyen)
            else if (jour <= 21) semaines[2].add(citoyen)
            else                 semaines[3].add(citoyen)
        })

        setDonneesSemaines(semaines.map(function(s, i) {
            return { x: `Sem ${i + 1}`, y: s.size }
        }))
    }

    async function chargerPartenairesEtGains() {
        const q = query(
            collection(db, 'partenaires'),
            where('statut', '==', 'valide')
        )
        const snapshot = await getDocs(q)

        const listePartenaires: Partenaire[] = []
        const listeContrats: ContratPartenaire[] = []
        const donneesMap: {[key: string]: DonneeGraphique[]} = {}

        snapshot.docs.forEach(function(d) {
            const montantFictif = Math.floor(Math.random() * (90000 - 20000 + 1)) + 20000
            listePartenaires.push({
                id: d.id,
                NomEntreprise: d.data().NomEntreprise || '',
                ville: d.data().ville || '',
            })
            listeContrats.push({
                id: d.id,
                NomEntreprise: d.data().NomEntreprise || '',
                ville: d.data().ville || '',
                montant: montantFictif,
            })
            donneesMap[d.id] = genererDonneesContrat()
        })

        const total = listeContrats.reduce(function(acc, c) { return acc + c.montant }, 0)
        const variationFictive = Math.floor(Math.random() * 30) - 10

        setPartenaires(listePartenaires)
        setContrats(listeContrats)
        setDonneesContrats(donneesMap)
        setGainsMois(total)
        setVariation(variationFictive)
    }

    function CarteQuartiers() {
                const quartiersVille = quartiers.filter(q => q.ville === villeSelectionnee);

                return (
                    <View style={{
                        backgroundColor: couleur.marineTransparent,
                        borderRadius: 20,
                        padding: 16,
                        marginBottom: 25,
                        borderWidth: 2,
                        borderColor: couleur.dore,
                    }}>
                        {/* Titre + Sélecteur de ville */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ color: couleur.doreClair, fontWeight: 'bold', fontSize: 18 }}>
                                Carte des quartiers
                            </Text>

                            {/* Bouton pour ouvrir le menu des villes */}
                            <TouchableOpacity 
                                onPress={() => setMenuVilleOuvert(!menuVilleOuvert)}
                                style={{
                                    backgroundColor: couleur.marine,
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: couleur.dore,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: couleur.doreClair, fontWeight: '600' }}>
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

                        {/* Menu déroulant des villes */}
                        {menuVilleOuvert && (
                            <View style={{
                                backgroundColor: couleur.marine,
                                borderRadius: 12,
                                padding: 8,
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: couleur.dore,
                            }}>
                                {villes.length === 0 ? (
                                    <Text style={{ color: '#ccc', padding: 8 }}>Aucune ville disponible</Text>
                                ) : (
                                    villes.map((ville) => (
                                        <TouchableOpacity
                                            key={ville}
                                            onPress={() => {
                                                setVilleSelectionnee(ville);
                                                setMenuVilleOuvert(false);   // Ferme le menu après sélection
                                            }}
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                backgroundColor: ville === villeSelectionnee ? couleur.dore : 'transparent',
                                            }}
                                        >
                                            <Text style={{
                                                color: ville === villeSelectionnee ? couleur.marine : couleur.doreClair,
                                                fontWeight: ville === villeSelectionnee ? 'bold' : 'normal',
                                            }}>
                                                {ville}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}

                        {/* Affichage des quartiers de la ville sélectionnée */}
                        <Text style={{ color: couleur.doreClair, fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                            Quartiers de {villeSelectionnee}
                        </Text>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
                            {quartiersVille.length === 0 ? (
                                <Text style={{ color: '#ccc', textAlign: 'center', padding: 20 }}>
                                    Aucun quartier trouvé pour {villeSelectionnee}
                                </Text>
                            ) : (
                                quartiersVille.map(q => (
                                    <QuartierItem key={q.nom} quartier={q} />
                                ))
                            )}
                        </View>
                    </View>
                );
            }
            function QuartierItem({ quartier }: { quartier: { nom: string; ville: string } }) {
                const [iconeCote, setIconeCote] = useState('🔴');
                const [score, setScore] = useState(0);

                useEffect(() => {
                    async function loadCote() {
                        try {
                            const snap = await getDoc(doc(db, 'cote', quartier.nom));
                            if (snap.exists()) {
                                const scoreTotal = snap.data().score_total || 0;
                                setScore(scoreTotal);
                                setIconeCote(scoreTotal >= 80 ? '🟢' : scoreTotal >= 40 ? '🟠' : '🔴');
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    loadCote();
                }, [quartier.nom]);

                return (
                    <TouchableOpacity style={{
                        width: width * 0.2,
                        backgroundColor: couleur.marine,
                        paddingVertical: 18,
                        paddingHorizontal: 4,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: couleur.dore,
                        alignItems: 'center',
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: couleur.doreClair, fontSize: 17, fontWeight: 'bold' }}>
                                {quartier.nom}
                            </Text>
                            <Text style={{ color: couleur.doreClair, fontSize: 17, fontWeight: 'bold', marginLeft: 6 }}>
                                : {score}
                            </Text>
                        </View>
                        <Text style={{ color: '#ccc', marginTop: 8, fontSize: 26 }}>{iconeCote}</Text>
                    </TouchableOpacity>
                );
            }

    function togglePartenaire(id: string) {
        setPartenaireOuvert(partenaireOuvert === id ? null : id)
    }

    if (chargement) {
        return (
            <ActivityIndicator size="large" color={couleur.dore} style={{ marginTop: '30%' }} />
        )
    }

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16}}><View style={{ flex: 1 }}>
            <Text style={stylesTitre.titre}>Statistiques</Text>

                <CarteQuartiers />
            {/* Navigation 4 icônes */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(201,168,76,0.3)',
                backgroundColor: 'rgba(41,79,120,0.3)'
            }}>
                {[
                    { id: 'depots',   icone: 'bar-chart',     label: 'Dépôts'    },
                    { id: 'semaines', icone: 'calendar',      label: 'Semaines'  },
                    { id: 'contrats', icone: 'storefront',    label: 'Contrats'  },
                    { id: 'gains',    icone: 'trending-up',   label: 'Gains'     },
                ].map(function(vue) {
                    const actif = vueActive === vue.id
                    return (
                        <TouchableOpacity
                            key={vue.id}
                            style={{ alignItems: 'center', paddingHorizontal: 8 }}
                            onPress={() => setVueActive(vue.id as any)}
                        >
                            <Ionicons
                                name={(actif ? vue.icone : vue.icone + '-outline') as any}
                                size={22}
                                color={actif ? couleur.dore : '#ccc'}
                            />
                            <Text style={{
                                fontSize: 9,
                                color: actif ? couleur.dore : '#ccc',
                                marginTop: 3,
                                fontWeight: actif ? 'bold' : 'normal'
                            }}>
                                {vue.label}
                            </Text>
                            {actif && (
                                <View style={{
                                    width: 20, height: 2,
                                    backgroundColor: couleur.dore,
                                    borderRadius: 1,
                                    marginTop: 3
                                }} />
                            )}
                        </TouchableOpacity>
                    )
                })}
            </View>

            {/* Contenu */}

                {/* ======================== VUE DÉPÔTS ======================== */}
                {vueActive === 'depots' && (
                    <View>
                        <Text style={stylesTitre.titre}>Dépôts par heure</Text>
                        <Text style={{ color: '#ccc', fontSize: 12, marginBottom: 15 }}>
                            Aujourd'hui — se réinitialise à minuit
                        </Text>

                        <View style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 15,
                            padding: 10,
                            marginBottom: 15,
                            borderWidth: 1,
                            borderColor: 'rgba(201,168,76,0.3)'
                        }}>
                            <VictoryChart
                                height={240}
                                padding={{ top: 20, bottom: 65, left: 50, right: 20 }}
                            >
                                <VictoryAxis
                                    style={{
                                        axis: { stroke: '#ccc' },
                                        tickLabels: {
                                            fill: '#ccc',
                                            fontSize: 10,
                                            angle: -45,
                                            textAnchor: 'end'
                                        }
                                    }}
                                />
                                <VictoryAxis
                                    dependentAxis
                                    style={{
                                        axis: { stroke: '#ccc' },
                                        tickLabels: { fill: '#ccc', fontSize: 10 }
                                    }}
                                />
                                <VictoryBar
                                    data={donneesDepots}
                                    style={{ data: { fill: couleur.dore } }}
                                    cornerRadius={{ top: 4 }}
                                />
                            </VictoryChart>
                        </View>

                        <View style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 12,
                            padding: 14,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(201,168,76,0.3)'
                        }}>
                            <Text style={{ color: '#ccc', fontSize: 13 }}>
                                Total du jour
                            </Text>
                            <Text style={{
                                color: couleur.dore,
                                fontSize: 28,
                                fontWeight: 'bold',
                                marginTop: 4
                            }}>
                                {totalDepots}
                            </Text>
                            <Text style={{ color: '#ccc', fontSize: 11 }}>dépôts</Text>
                        </View>
                    </View>
                )}

                {/* ======================== VUE SEMAINES ======================== */}
                {vueActive === 'semaines' && (
                    <View>
                        <Text style={stylesTitre.titre}>Citoyens actifs</Text>
                        <Text style={{ color: '#ccc', fontSize: 12, marginBottom: 15 }}>
                            {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                        </Text>

                        <View style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 15,
                            padding: 10,
                            marginBottom: 15,
                            borderWidth: 1,
                            borderColor: 'rgba(201,168,76,0.3)'
                        }}>
                            <VictoryChart
                                height={240}
                                padding={{ top: 20, bottom: 50, left: 50, right: 20 }}
                            >
                                <VictoryAxis
                                    style={{
                                        axis: { stroke: '#ccc' },
                                        tickLabels: { fill: '#ccc', fontSize: 11 }
                                    }}
                                />
                                <VictoryAxis
                                    dependentAxis
                                    style={{
                                        axis: { stroke: '#ccc' },
                                        tickLabels: { fill: '#ccc', fontSize: 10 }
                                    }}
                                />
                                <VictoryBar
                                    data={donneesSemaines}
                                    style={{ data: { fill: couleur.turquoise } }}
                                    cornerRadius={{ top: 4 }}
                                />
                            </VictoryChart>
                        </View>

                        <Text style={{ color: '#ccc', fontSize: 11, textAlign: 'center' }}>
                            Citoyens uniques ayant effectué au moins 1 dépôt par semaine
                        </Text>
                    </View>
                )}

                {/* ======================== VUE CONTRATS ======================== */}
                {vueActive === 'contrats' && (
                    <View>
                        <Text style={stylesTitre.titre}>Contrats partenaires</Text>

                        <View style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 15,
                            borderWidth: 1,
                            borderColor: couleur.dore,
                            alignItems: 'center'
                        }}>
                            <Text style={{ color: couleur.dore, fontWeight: 'bold' }}>
                                Seuil minimal : {formaterMontant(SEUIL_MINIMAL)}
                            </Text>
                        </View>

                        {partenaires.length === 0 ? (
                            <Text style={{ color: '#ccc', textAlign: 'center', marginTop: 20 }}>
                                Aucun partenaire validé
                            </Text>
                        ) : (
                            partenaires.map(function(p) {
                                const estOuvert = partenaireOuvert === p.id
                                return (
                                    <View key={p.id} style={{ marginBottom: 10 }}>
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: couleur.marineTransparent,
                                                borderRadius: 12,
                                                padding: 14,
                                                borderWidth: 1,
                                                borderColor: estOuvert
                                                    ? couleur.dore
                                                    : 'rgba(201,168,76,0.3)',
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                            onPress={() => togglePartenaire(p.id)}
                                        >
                                            <View>
                                                <Text style={{
                                                    color: couleur.blanc,
                                                    fontWeight: 'bold',
                                                    fontSize: 14
                                                }}>
                                                    {p.NomEntreprise}
                                                </Text>
                                                <Text style={{ color: '#ccc', fontSize: 11 }}>
                                                    {p.ville}
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name={estOuvert ? 'chevron-up' : 'chevron-down'}
                                                size={18}
                                                color={couleur.dore}
                                            />
                                        </TouchableOpacity>

                                        {estOuvert && donneesContrats[p.id] && (
                                            <View style={{
                                                backgroundColor: 'rgba(41,79,120,0.5)',
                                                borderRadius: 12,
                                                marginTop: 4,
                                                padding: 10,
                                                borderWidth: 1,
                                                borderColor: 'rgba(201,168,76,0.3)'
                                            }}>
                                                <ScrollView
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                >
                                                    <VictoryChart
                                                        width={600}
                                                        height={200}
                                                        padding={{ top: 20, bottom: 50, left: 60, right: 20 }}
                                                    >
                                                        <VictoryAxis
                                                            style={{
                                                                axis: { stroke: '#ccc' },
                                                                tickLabels: {
                                                                    fill: '#ccc',
                                                                    fontSize: 10,
                                                                    angle: -45,
                                                                    textAnchor: 'end'
                                                                }
                                                            }}
                                                        />
                                                        <VictoryAxis
                                                            dependentAxis
                                                            tickFormat={(t) => `${Math.round(t / 1000)}k`}
                                                            style={{
                                                                axis: { stroke: '#ccc' },
                                                                tickLabels: { fill: '#ccc', fontSize: 9 }
                                                            }}
                                                        />
                                                        <VictoryBar
                                                            data={donneesContrats[p.id]}
                                                            style={{ data: { fill: couleur.dore } }}
                                                            cornerRadius={{ top: 3 }}
                                                        />
                                                    </VictoryChart>
                                                </ScrollView>
                                                <Text style={{
                                                    color: '#ccc',
                                                    fontSize: 10,
                                                    textAlign: 'center',
                                                    marginTop: 4
                                                }}>
                                                    Données simulées — 12 derniers mois
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )
                            })
                        )}
                    </View>
                )}

                {/* ======================== VUE GAINS ======================== */}
                {vueActive === 'gains' && (
                    <View>
                        <Text style={stylesTitre.titre}>Gains Hyzakam</Text>

                        {/* Cartes résumé */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            <View style={{
                                flex: 1,
                                backgroundColor: couleur.marineTransparent,
                                borderRadius: 15,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: couleur.dore,
                                alignItems: 'center'
                            }}>
                                <Ionicons name="cash-outline" size={26} color={couleur.dore} />
                                <Text style={{
                                    color: couleur.blanc,
                                    fontSize: 14,
                                    fontWeight: 'bold',
                                    marginTop: 8,
                                    textAlign: 'center'
                                }}>
                                    {formaterMontant(gainsMois)}
                                </Text>
                                <Text style={{ color: '#ccc', fontSize: 11, marginTop: 4 }}>
                                    Gains ce mois
                                </Text>
                            </View>

                            <View style={{
                                flex: 1,
                                backgroundColor: couleur.marineTransparent,
                                borderRadius: 15,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: couleur.turquoise,
                                alignItems: 'center'
                            }}>
                                <Ionicons
                                    name={variation >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                                    size={26}
                                    color={variation >= 0 ? couleur.turquoise : couleur.erreurClair}
                                />
                                <Text style={{
                                    color: variation >= 0 ? couleur.turquoise : couleur.erreurClair,
                                    fontSize: 22,
                                    fontWeight: 'bold',
                                    marginTop: 8
                                }}>
                                    {variation >= 0 ? '+' : ''}{variation}%
                                </Text>
                                <Text style={{ color: '#ccc', fontSize: 11, marginTop: 4 }}>
                                    vs mois précédent
                                </Text>
                            </View>
                        </View>

                        {/* Alerte seuil */}
                        {contrats.filter(c => c.montant < SEUIL_MINIMAL).length > 0 ? (
                            <View style={{
                                backgroundColor: 'rgba(94,41,35,0.6)',
                                borderRadius: 12,
                                padding: 14,
                                marginBottom: 20,
                                borderWidth: 1,
                                borderColor: couleur.erreur,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <Ionicons name="warning-outline" size={22} color={couleur.erreurClair} />
                                <Text style={{ color: couleur.blanc, flex: 1 }}>
                                    ⚠️ {contrats.filter(c => c.montant < SEUIL_MINIMAL).length} partenaire(s) sous le seuil de 25 000 FCFA
                                </Text>
                            </View>
                        ) : (
                            <View style={{
                                backgroundColor: 'rgba(45,106,79,0.3)',
                                borderRadius: 12,
                                padding: 14,
                                marginBottom: 20,
                                borderWidth: 1,
                                borderColor: couleur.vert,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <Ionicons name="checkmark-circle-outline" size={22} color={couleur.turquoise} />
                                <Text style={{ color: couleur.turquoise }}>
                                    ✅ Tous les contrats respectent le seuil minimal
                                </Text>
                            </View>
                        )}

                        {/* Graphique tendance */}
                        <Text style={stylesTitre.sousTitre}>Tendance des gains</Text>
                        <View style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 15,
                            padding: 10,
                            marginBottom: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(201,168,76,0.3)'
                        }}>
                            <VictoryChart
                                height={220}
                                padding={{ top: 20, bottom: 50, left: 70, right: 20 }}
                            >
                                <VictoryAxis
                                    style={{
                                        axis: { stroke: '#ccc' },
                                        tickLabels: { fill: '#ccc', fontSize: 11 }
                                    }}
                                />
                                <VictoryAxis
                                    dependentAxis
                                    tickFormat={(t) => `${Math.round(t / 1000)}k`}
                                    style={{
                                        axis: { stroke: '#ccc' },
                                        tickLabels: { fill: '#ccc', fontSize: 10 }
                                    }}
                                />
                                <VictoryLine
                                    data={donneesTendanceFictives}
                                    style={{ data: { stroke: couleur.dore, strokeWidth: 2.5 } }}
                                />
                                <VictoryScatter
                                    data={donneesTendanceFictives}
                                    size={5}
                                    style={{ data: { fill: couleur.doreClair } }}
                                />
                            </VictoryChart>
                            <Text style={{ color: '#ccc', fontSize: 10, textAlign: 'center' }}>
                                6 derniers mois — données simulées
                            </Text>
                        </View>

                        {/* Liste détaillée */}
                        <Text style={stylesTitre.sousTitre}>Détail des contrats</Text>
                        {contrats.map(function(c) {
                            const sousLeSeuil = c.montant < SEUIL_MINIMAL
                            return (
                                <View key={c.id} style={{
                                    backgroundColor: couleur.marineTransparent,
                                    borderRadius: 12,
                                    padding: 14,
                                    marginBottom: 10,
                                    borderWidth: 1,
                                    borderColor: sousLeSeuil
                                        ? couleur.erreur
                                        : 'rgba(201,168,76,0.3)',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12
                                }}>
                                    <View style={{
                                        width: 14, height: 14, borderRadius: 7,
                                        backgroundColor: sousLeSeuil ? couleur.erreurClair : couleur.vert
                                    }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{
                                            color: couleur.blanc,
                                            fontWeight: 'bold',
                                            fontSize: 14
                                        }}>
                                            {c.NomEntreprise}
                                        </Text>
                                        <Text style={{ color: '#ccc', fontSize: 11 }}>
                                            {c.ville}
                                        </Text>
                                    </View>
                                    <Text style={{
                                        color: sousLeSeuil ? couleur.erreurClair : couleur.dore,
                                        fontWeight: 'bold',
                                        fontSize: 13
                                    }}>
                                        {formaterMontant(c.montant)}
                                    </Text>
                                </View>
                            )
                        })}
                    </View>
                )}

                <View style={{ height: 30 }} />
            </View>
        </ScrollView>
    )
}