import { useState, useEffect} from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput,ActivityIndicator} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { couleur, stylesTitre } from '../../constants/animation'
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, Timestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebaseConfig'

export default function OngletAccueil() {

    const [quartierChoisi, setQuartierChoisi] = useState('Tamdja')
    const [menuQuartierOuvert, setMenuQuartierOuvert] = useState(false)

    const [statsJour, setStatsJour] = useState({
    depots: 0,
    coupons: 0,
    partenaires: 0,
    points: 0
    })
    const [villes, setVilles] = useState<string[]>([])
    const [tousQuartiers, setTousQuartiers] = useState<{ville: string, nom: string}[]>([])
    const [chargement, setChargement] = useState(true)

    const [alertes, setAlertes] = useState<{
        uID: string,
        nom: string,
        message: string,
        valeur: number,
        occurences: number
    }[]>([])
    const carteStats = [
        { label: 'Dépôts aujourd\'hui',  valeur: statsJour.depots.toString(),      icone: 'trash-outline'      },
        { label: 'Coupons validés',       valeur: statsJour.coupons.toString(),     icone: 'pricetag-outline'   },
        { label: 'Partenaires actifs',    valeur: statsJour.partenaires.toString(), icone: 'storefront-outline' },
        { label: 'Points distribués',     valeur: statsJour.points.toString(),      icone: 'star-outline'       },
    ]
    const [nouvelleVille, setNouvelleVille] = useState('') //ajouter de nouvelle ville
    const [nouveauQuartier, setNouveauQuartier] = useState('')
    const [villeChoisie, setVilleChoisie] = useState('Bafoussam')
    const [menuVilleOuvert, setMenuVilleOuvert] = useState(false)
    const quartiersFiltres = villeChoisie === '' 
    ? [] 
    : tousQuartiers.filter(q => q.ville === villeChoisie).map(q => q.nom)

    useEffect(function() { //dit a react execute ce code apres que l'ecran s'affiche
        chargerDonnees()
    }, [])

        function construireMessage(valeur: number, occurences: number): string {
            const niveau = valeur >= 3 ? '🔴 Audit urgent' : '🟠 À surveiller'
            return `${niveau} — ${valeur}x la moyenne (${occurences} fois)`
        }
    async function chargerDonnees() {
    setChargement(true)
    try {
        // Début et fin de la journée actuelle
        const debutJour = new Date()
        debutJour.setHours(0, 0, 0, 0)
        const finJour = new Date()
        finJour.setHours(23, 59, 59, 999)

        // 1 — Dépôts du jour
        const qDepots = query(
            collection(db, 'depots'),
            where('date', '>=', Timestamp.fromDate(debutJour)),
            where('date', '<=', Timestamp.fromDate(finJour))
        )
        const snapshotDepots = await getDocs(qDepots)

        // 2 — Points distribués aujourd'hui
        let totalPoints = 0
        snapshotDepots.forEach(function(document) {
            totalPoints += document.data().point || 0
        })

        // 3 — Coupons validés aujourd'hui
        const qCoupons = query(
            collection(db, 'coupons'),
            where('statut', '==', 'utilise'),
            where('date_achat', '>=', Timestamp.fromDate(debutJour)),
            where('date_achat', '<=', Timestamp.fromDate(finJour))
        )
        const snapshotCoupons = await getDocs(qCoupons)

        // 4 — Partenaires actifs(etablissemment)
        const snapshotPartenaires = await getDocs(collection(db, 'etablissements'))

        // 5 — Villes et quartiers depuis configuration
        const docZones = await getDoc(doc(db, 'configuration', 'zones'))
        if (docZones.exists()) {
            setVilles(docZones.data().villes || [])
            setTousQuartiers(docZones.data().quartiers || [])
        }

        // Mettre à jour les stats
        setStatsJour({
            depots: snapshotDepots.size,
            coupons: snapshotCoupons.size,
            partenaires: snapshotPartenaires.size,
            points: totalPoints
        })

        // 6 — Alertes non traitées
        const qAlertes = query(
            collection(db, 'alertes'),
            where('traite', '==', false)
        )
        const snapshotAlertes = await getDocs(qAlertes)
        const alertesFirebase = snapshotAlertes.docs.map(function(document) {
            return {
                uID: document.id,
                nom: document.data().nom,
                valeur: document.data().valeur,
                occurences: document.data().occurences,
                message: construireMessage(document.data().valeur, document.data().occurences),
            }
        })
        setAlertes(alertesFirebase)

        } catch (e:any) {
            console.log('Erreur chargement:', e)
            alert(e.message)
            alert(e.code)
        } finally{
        setChargement(false)
        }
    }

    async function noterQuartier(note: 'propre' | 'passable' | 'sale') {
        if (quartierChoisi === '') {
            return
        }
        try {
                const changement = note === 'propre' ? 1 : note === 'sale' ? -1 : 0
                const docRef= doc(db,'cote',quartierChoisi)
                const snapshot = await getDoc(docRef)
                if(snapshot.exists()){
                    await updateDoc(docRef,{
                        score_total: increment(changement)
                    })
                }
                else{
                    await setDoc(docRef,{
                        nom_quartier:quartierChoisi,
                        score_total:changement,
                    })
                }
                console.log(`${quartierChoisi} noté ${note}`)
        } catch (e) {
            console.log('Erreur notation:', e)
            alert(e)
        }
    }
    
    async function ajouterVille() {
        if (nouvelleVille.trim() === '') return 
        // .trim() sert a enlever les espaces avant et apres le mot
        const nouvelleListe = [...villes, nouvelleVille.trim()]
        await updateDoc(doc(db, 'configuration', 'zones'), { villes: nouvelleListe })
        setVilles(nouvelleListe)
        setNouvelleVille('')
    }

    async function supprimerVille(ville: string) {
        const nouvelleListe = villes.filter(v => v !== ville)
        await updateDoc(doc(db, 'configuration', 'zones'), { villes: nouvelleListe })
        setVilles(nouvelleListe)
    }

    async function ajouterQuartier() {
        if (nouveauQuartier.trim() === '') return
        if (villeChoisie==='') return 
        const nouvelleListe = [...tousQuartiers, {nom : nouveauQuartier.trim(), ville: villeChoisie}]
        await updateDoc(doc(db, 'configuration', 'zones'), { quartiers: nouvelleListe })
        setTousQuartiers(nouvelleListe)
        setNouveauQuartier('')
    }

    async function supprimerQuartier(q: string) {
        const nouvelleListe = tousQuartiers.filter(item => item.nom !== q)
        await updateDoc(doc(db, 'configuration', 'zones'), { quartiers: nouvelleListe })
        setTousQuartiers(nouvelleListe)
    }

    if (chargement) {
        return  <ActivityIndicator size="large" color={couleur.dore} style={{ marginTop: '30%' }} />
    }

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

            {/* Titre */}
            <Text style={stylesTitre.titre}>
                Tableau de bord
            </Text>

            {/* Stats du jour */}
            <Text style={stylesTitre.sousTitre}>
                Aujourd'hui
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 }}>
                {carteStats.map((stat) => (
                    <View key={stat.label} style={{
                        backgroundColor: couleur.marineTransparent,
                        borderRadius: 15,
                        padding: 15,
                        width: '47%',
                        borderWidth: 1.5,
                        borderColor: 'rgba(201,168,76,0.3)',
                    }}>
                        <Ionicons name={stat.icone as any} size={24} color={couleur.dore} />
                        <Text style={{ color: couleur.blanc, fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
                            {stat.valeur}
                        </Text>
                        <Text style={{ color: '#ccc', fontSize: 12, marginTop: 4, fontWeight:'bold' }}>
                            {stat.label}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Alertes */}
            <Text style={stylesTitre.sousTitre}>
                ⚠️ Alertes responsables
            </Text>

            {alertes.length === 0 ? (
                <Text style={{ color: '#ccc', marginBottom: 25 }}>
                    Aucune alerte pour le moment ✅
                </Text>
            ) : (
                <View style={{ marginBottom: 25 }}>
                    {alertes.map((alerte) => (
                        <View key={alerte.uID} style={{
                            backgroundColor: 'rgba(94,41,35,0.6)',
                            borderRadius: 15,
                            padding: 15,
                            marginBottom: 10,
                            borderWidth: 1.5,
                            borderColor: couleur.erreur,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <Ionicons name="alert-circle" size={24} color={couleur.erreurClair} />
                            <View>
                                <Text style={{ color: couleur.blanc, fontWeight: 'bold' }}>
                                    {alerte.nom}
                                </Text>
                                <Text style={{ color: '#ccc', fontSize: 12 }}>
                                    {alerte.message}
                                </Text>
                                <TouchableOpacity
                                onPress={async () => {
                                    // Marque comme traité dans Firebase
                                    await updateDoc(doc(db, 'alertes', alerte.uID), {
                                        traite: true
                                    })
                                    // Supprime de l'affichage local
                                    setAlertes(alertes.filter(a => a.uID !== alerte.uID))
                                }}
                                style={{
                                    marginTop: 8,
                                    backgroundColor: couleur.marine,
                                    borderRadius: 10,
                                    padding: 8,
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: couleur.dore
                                }}
                            >
                                <Text style={{ color: couleur.dore, fontSize: 12, fontWeight: 'bold' }}>
                                    ✓ Vérification effectuée
                                </Text>
                            </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Notation quartier */}
            {/* Notation quartier */}
            <Text style={stylesTitre.sousTitre}>
                🏘️ Noter un quartier
            </Text>

            {/* Menu déroulant VILLE */}
            <Text style={{ color: couleur.dore, marginBottom: 5, fontSize: 12 }}>
                Ville
            </Text>
            <TouchableOpacity
                style={{
                    backgroundColor: couleur.marineTransparent,
                    borderRadius: 15,
                    padding: 14,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: couleur.dore,
                    marginBottom: 10
                }}
                onPress={() => setMenuVilleOuvert(!menuVilleOuvert)}
            >
                <Text style={{ color: villeChoisie === '' ? '#ccc' : couleur.blanc }}>
                    {villeChoisie === '' ? 'Choisir une ville...' : villeChoisie}
                </Text>
                <Ionicons
                    name={menuVilleOuvert ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={couleur.dore}
                />
            </TouchableOpacity>

            {menuVilleOuvert && (
                <View style={{
                    backgroundColor: 'rgba(41,79,120,0.95)',
                    borderRadius: 15,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: couleur.dore,
                    overflow: 'hidden'
                }}>
                    {villes.map((v) => (
                        <TouchableOpacity
                            key={v}
                            style={{
                                padding: 14,
                                borderBottomWidth: v === villes[villes.length - 1] ? 0 : 0.5,
                                borderBottomColor: 'rgba(255,255,255,0.2)'
                            }}
                            onPress={() => {
                                setVilleChoisie(v)
                                setMenuVilleOuvert(false)
                                setQuartierChoisi('') // réinitialise le quartier
                            }}
                        >
                            <Text style={{
                                color: villeChoisie === v ? couleur.doreClair : couleur.blanc,
                                fontWeight: villeChoisie === v ? 'bold' : 'normal'
                            }}>
                                {v}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Menu déroulant QUARTIER — débloqué seulement si ville choisie */}
            {villeChoisie !== '' && (
                <>
                    <Text style={{ color: couleur.dore, marginBottom: 5, fontSize: 12 }}>
                        Quartier
                    </Text>
                    <TouchableOpacity
                        style={{
                            backgroundColor: couleur.marineTransparent,
                            borderRadius: 15,
                            padding: 14,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            borderWidth: 1,
                            borderColor: couleur.dore,
                            marginBottom: 10
                        }}
                        onPress={() => setMenuQuartierOuvert(!menuQuartierOuvert)}
                    >
                        <Text style={{ color: quartierChoisi === '' ? '#ccc' : couleur.blanc }}>
                            {quartierChoisi === '' ? 'Choisir un quartier...' : quartierChoisi}
                        </Text>
                        <Ionicons
                            name={menuQuartierOuvert ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={couleur.dore}
                        />
                    </TouchableOpacity>

                    {menuQuartierOuvert && (
                        <View style={{
                            backgroundColor: 'rgba(41,79,120,0.95)',
                            borderRadius: 15,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: couleur.dore,
                            overflow: 'hidden'
                        }}>
                            {quartiersFiltres.map((q) => (
                                <TouchableOpacity
                                    key={q}
                                    style={{
                                        padding: 14,
                                        borderBottomWidth: q === quartiersFiltres[quartiersFiltres.length - 1] ? 0 : 0.5,
                                        borderBottomColor: 'rgba(255,255,255,0.2)'
                                    }}
                                    onPress={() => {
                                        setQuartierChoisi(q)
                                        setMenuQuartierOuvert(false)
                                    }}
                                >
                                    <Text style={{
                                        color: quartierChoisi === q ? couleur.doreClair : couleur.blanc,
                                        fontWeight: quartierChoisi === q ? 'bold' : 'normal'
                                    }}>
                                        {q}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Boutons notation — débloqués seulement si quartier choisi */}
                    {quartierChoisi !== '' && (
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30 }}>
                            <TouchableOpacity style={{
                                flex: 1, backgroundColor: couleur.vert,
                                borderRadius: 15, padding: 14, alignItems: 'center',
                                borderColor: couleur.blanc, borderWidth: 0.5
                            }}
                                onPress={() => noterQuartier('propre')}
                            >
                                <Ionicons name="leaf" size={20} color="#fff" />
                                <Text style={{ color: '#fff', marginTop: 5, fontWeight: 'bold' }}>Propre</Text>
                                <Text style={{ color: '#ccc', fontSize: 11 }}>+1 cote</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{
                                flex: 1, backgroundColor: couleur.marineTransparent,
                                borderRadius: 15, padding: 14, alignItems: 'center',
                                borderWidth: 1, borderColor: couleur.dore
                            }}
                                onPress={() => noterQuartier('passable')}
                            >
                                <Ionicons name="remove-circle-outline" size={20} color={couleur.dore} />
                                <Text style={{ color: couleur.dore, marginTop: 5, fontWeight: 'bold' }}>Passable</Text>
                                <Text style={{ color: '#ccc', fontSize: 11 }}>Aucun effet</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{
                                flex: 1, backgroundColor: 'rgba(94,41,35,0.7)',
                                borderRadius: 15, padding: 14, alignItems: 'center',
                                borderWidth: 1, borderColor: couleur.erreurClair
                            }}
                                onPress={() => noterQuartier('sale')}
                            >
                                <Ionicons name="trash" size={20} color={couleur.erreurClair} />
                                <Text style={{ color: couleur.erreurClair, marginTop: 5, fontWeight: 'bold' }}>Sale</Text>
                                <Text style={{ color: '#ccc', fontSize: 11 }}>-1 cote</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}
            {/* Gestion des zones */}
            <Text style={stylesTitre.sousTitre}>
                🌍 Gérer les zones
            </Text>

            {/* Villes */}
            <Text style={{ color: couleur.dore, marginBottom: 8, fontWeight: 'bold' }}>
                Villes
            </Text>
            {villes.map((ville) => (
                <View key={ville} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: couleur.marineTransparent,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(201,168,76,0.3)',
                }}>
                    <Text style={{ color: couleur.blanc }}>{ville}</Text>
                    <TouchableOpacity onPress={() => supprimerVille(ville)}>
                        <Ionicons name="trash-outline" size={18} color={couleur.erreurClair} />
                    </TouchableOpacity>
                </View>
            ))}

            {/* Champ ajouter ville */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TextInput
                    style={{
                        flex: 1,
                        backgroundColor: couleur.marineTransparent,
                        borderRadius: 10,
                        padding: 12,
                        color: couleur.blanc,
                        borderWidth: 1,
                        borderColor: couleur.dore,
                    }}
                    placeholder="Nouvelle ville..."
                    placeholderTextColor="#ccc"
                    value={nouvelleVille}
                    onChangeText={setNouvelleVille}
                />
                <TouchableOpacity
                    style={{
                        backgroundColor: couleur.dore,
                        borderRadius: 10,
                        padding: 12,
                        justifyContent: 'center',
                    }}
                    onPress={ajouterVille}
                >
                    <Ionicons name="add" size={22} color={couleur.marine} />
                </TouchableOpacity>
            </View>

            {/* Quartiers */}
            <Text style={{ color: couleur.dore, marginBottom: 8, fontWeight: 'bold' }}>
                Quartiers
            </Text>
            {tousQuartiers.map((q) => (
                <View key={q.nom} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: couleur.marineTransparent,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(201,168,76,0.3)',
                }}>
                    <Text style={{ color: couleur.blanc }}>{q.nom}</Text>
                    <TouchableOpacity onPress={() => supprimerQuartier(q.nom)}>
                        <Ionicons name="trash-outline" size={18} color={couleur.erreurClair} />
                    </TouchableOpacity>
                </View>
            ))}

            {/* Champ ajouter quartier */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30 }}>
                <TextInput
                    style={{
                        flex: 1,
                        backgroundColor: couleur.marineTransparent,
                        borderRadius: 10,
                        padding: 12,
                        color: couleur.blanc,
                        borderWidth: 1,
                        borderColor: couleur.dore,
                    }}
                    placeholder="Nouveau quartier..."
                    placeholderTextColor="#ccc"
                    value={nouveauQuartier}
                    onChangeText={setNouveauQuartier}
                />
                <TouchableOpacity
                    style={{
                        backgroundColor: couleur.dore,
                        borderRadius: 10,
                        padding: 12,
                        justifyContent: 'center',
                    }}
                    onPress={ajouterQuartier}
                >
                    <Ionicons name="add" size={22} color={couleur.marine} />
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}