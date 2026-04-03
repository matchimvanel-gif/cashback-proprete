import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator,Modal, TextInput,Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { couleur, stylesTitre } from '../../constants/animation'
import { collection, getDocs, doc, setDoc, updateDoc,getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebaseConfig'

type Partenaire = {
    id: string
    Id_contrat: string
    NomEntreprise: string
    email: string
    Numero_de_telephone: string
    ville: string
    statut: 'en_attente' | 'valide' | 'refuse'
    date_demande: string
}

export default function OngletPartenaires() {

    const [partenaires, setPartenaires] = useState<Partenaire[]>([])
    const [chargement, setChargement] = useState(true)
    const [ficheOuverte, setFicheOuverte] = useState<Partenaire | null>(null)
    const [popupAjout, setPopupAjout] = useState(false)

    // Champs formulaire ajout
    const [nomNouv, setNomNouv] = useState('')
    const [emailNouv, setEmailNouv] = useState('')
    const [telNouv, setTelNouv] = useState('')
    const [idContratNouv,setIdContratNouv]=useState('')
    const [menuVilleOuvert,setMenuVilleOuvert]=useState(false)
    const [nomVille,setNomVille]=useState<string[]>([])
    const [ville,setVille]=useState('Bafoussam');

    const enAttente = partenaires.filter(p => p.statut === 'en_attente')
    const valides   = partenaires.filter(p => p.statut === 'valide')

    useEffect(function() {
        chargerPartenaires()
    }, [])

    async function chargerPartenaires() {
        setChargement(true)
        try {
            const snapshotVilleQuatier= await getDoc(doc(db,'configuration','zones'))
                if(snapshotVilleQuatier.exists()){
                    setNomVille(snapshotVilleQuatier.data().villes || [])
                }
            const snapshot = await getDocs(collection(db, 'partenaires'))
            const liste = snapshot.docs.map(function(d) {
                return {
                    id: d.id,
                    Id_contrat:d.data().Id_contrat,
                    NomEntreprise: d.data().NomEntreprise || '',
                    email: d.data().email || '',
                    Numero_de_telephone: d.data().Numero_de_telephone || '',
                    ville: d.data().ville || '',
                    statut: d.data().statut || 'en_attente',
                    date_demande: d.data().date_demande ?.toDate?d.data().date_demande.toDate().toLocaleDateString('fr-FR'):d.data().date_demande||'',
                } as Partenaire
            })
            setPartenaires(liste.filter(p => p.statut !== 'refuse'))
        } catch (e:any) {
            console.log('Erreur chargement partenaires:', e)
            alert(e.message)
        } finally {
            setChargement(false)
        }
    }
    // {Notification push pour le message}
    async function envoyerWhatsApp(telephone: string, code: string) {
        // On retire le premier '0' ou le '+' pour avoir un format international propre (ex: 2376...)
        // Si tes numéros sont déjà au format 695..., on ajoute le code pays 237
        const numeroPropre = telephone.startsWith('237') ? telephone : `237${telephone}`;
        
        const message = `Bonjour ! Votre code partenaire pour Cashback de Propreté est : ${code}. Utilisez-le pour finaliser votre inscription.`;
        
        // On crée l'URL magique pour WhatsApp
        const url = `whatsapp://send?phone=${numeroPropre}&text=${encodeURIComponent(message)}`;

        try {
            const supporte = await Linking.canOpenURL(url);
            if (supporte) {
                await Linking.openURL(url);
            } else {
                alert("WhatsApp n'est pas installé sur ce téléphone");
            }
        } catch (error) {
            console.log("Erreur WhatsApp:", error);
        }
    }

    function genererCode(): string {
        const lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz'
        const chiffres = '0123456789'
        let prefix = ''
        let suffix = ''
        for (let i = 0; i < 4; i++) {
            prefix += lettres[Math.floor(Math.random() * lettres.length)]
        }
        for (let i = 0; i < 4; i++) {
            suffix += chiffres[Math.floor(Math.random() * chiffres.length)]
        }
        return prefix + '-' + suffix
    }
    function ouvrirPopupAjout(){
        setIdContratNouv(genererCode())
        setPopupAjout(true)
    }
    async function ajouterPartenaire(partenaire: Partenaire) {
        if (nomNouv === '' || emailNouv === '' || telNouv === '') return 
        try {
            const newDoc = doc(collection(db, 'partenaires'))
            await setDoc(newDoc, {
                NomEntreprise: nomNouv,
                email: emailNouv,
                Numero_de_telephone: telNouv,
                ville: ville,
                statut: 'valide',
                date_demande: Timestamp.now(),
                Id_contrat:idContratNouv,
                status:'actif',
            })
            // Envoyer le code
            await envoyerWhatsApp(partenaire.Numero_de_telephone,partenaire.Id_contrat)
            setPopupAjout(false);
            setNomNouv('');
            setEmailNouv('');
            setTelNouv('');
            chargerPartenaires();
        } catch (e:any) {
            console.log('Erreur ajout:', e.message)
            alert(e.message)
        }
    }

    if(chargement) return <ActivityIndicator size="large" color={couleur.dore} style={{ marginTop: '20%' }} />
                
    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

            {/* Titre + bouton ajouter */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={stylesTitre.titre}>Partenaires</Text>
                <TouchableOpacity
                    style={{
                        backgroundColor: couleur.dore,
                        borderRadius: 20,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        flexDirection: 'row',
                        gap: 6,
                        alignItems: 'center'
                    }}
                    onPress={() => ouvrirPopupAjout()}
                >
                    <Ionicons name="add" size={18} color={couleur.marine} />
                    <Text style={{ color: couleur.marine, fontWeight: 'bold' }}>Ajouter</Text>
                </TouchableOpacity>
            </View>

            {/* Tableau 2 colonnes */}
            <View style={{ flexDirection: 'column', gap: 10 }}>

                {/* Colonne Validés */}
                <View style={{ flex: 1 }}>
                    <Text style={{
                        color: couleur.turquoise,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        textAlign: 'center',
                        fontSize: 13
                    }}>
                        ✅ Validés ({valides.length})
                    </Text>
                    {valides.length === 0 ? (
                        <Text style={{ color: '#ccc', fontSize: 12, textAlign: 'center' }}>
                            Aucun partenaire
                        </Text>
                    ) : (
                        valides.map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                style={{
                                    backgroundColor: 'rgba(78,205,196,0.15)',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginBottom: 8,
                                    borderWidth: 1,
                                    borderColor: couleur.turquoise,
                                }}
                                onPress={() => {
                                    setFicheOuverte(p)
                                }}
                            >
                                <Text style={{ color: couleur.blanc, fontWeight: 'bold', fontSize: 13 }}>
                                    {p.NomEntreprise}
                                </Text>
                                <Text style={{ color: '#ccc', fontSize: 11 }}>
                                    {p.ville}
                                </Text>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </View>

            {/* Fiche détaillée */}
            <Modal
                visible={ficheOuverte !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setFicheOuverte(null)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20
                }}>
                    <View style={{
                        backgroundColor: couleur.marine,
                        borderRadius: 20,
                        padding: 24,
                        width: '100%',
                        borderWidth: 1,
                        borderColor: couleur.dore
                    }}>
                        {/* Fermer */}
                        <TouchableOpacity
                            style={{ alignSelf: 'flex-end', marginBottom: 10 }}
                            onPress={() => setFicheOuverte(null)}
                        >
                            <Ionicons name="close-circle" size={28} color={couleur.erreurClair} />
                        </TouchableOpacity>

                        {ficheOuverte && (
                            <>
                                <Text style={{ color: couleur.doreClair, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                                    {ficheOuverte.NomEntreprise}
                                </Text>

                                {/* Infos */}
                                {[
                                    { icone: 'mail-outline',     valeur: ficheOuverte.email     },
                                    { icone: 'call-outline',     valeur: ficheOuverte.Numero_de_telephone },
                                    { icone: 'location-outline', valeur: ficheOuverte.ville     },
                                    { icone: 'calendar-outline', valeur: ficheOuverte.date_demande },
                                ].map((info) => (
                                    <View key={info.icone} style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 10,
                                        marginBottom: 10
                                    }}>
                                        <Ionicons name={info.icone as any} size={18} color={couleur.dore} />
                                        <Text style={{ color: couleur.blanc }}>{info.valeur}</Text>
                                    </View>
                                ))}
                                {ficheOuverte.statut === 'valide' && (
                                    <View style={{
                                        backgroundColor: 'rgba(45,106,79,0.3)',
                                        borderRadius: 12,
                                        padding: 12,
                                        marginTop: 10,
                                        alignItems: 'center'
                                    }}>
                                        <Text style={{ color: couleur.turquoise }}>
                                            ✅ Partenaire validé
                                        </Text>
                                        {ficheOuverte.Id_contrat && (
                                            <Text style={{ color: '#ccc', fontSize: 12, marginTop: 4 }}>
                                                Code : {ficheOuverte.Id_contrat}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Popup ajout partenaire 
                //*modal est une sorte de view mais qui est specialiser pour les popup
            */}
            <Modal  
                visible={popupAjout}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPopupAjout(false)}
            >
                <ScrollView>
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20
                }}>
                    <View style={{
                        backgroundColor: couleur.marine,
                        borderRadius: 20,
                        padding: 24,
                        width: '100%',
                        borderWidth: 1,
                        borderColor: couleur.dore
                    }}>
                        {/* Fermer */}
                        <TouchableOpacity
                            style={{ alignSelf: 'flex-end', marginBottom: 10 }}
                            onPress={() => setPopupAjout(false)}
                        >
                            <Ionicons name="close-circle" size={28} color={couleur.erreurClair} />
                        </TouchableOpacity>

                        <Text style={{ color: couleur.doreClair, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                            Nouveau partenaire
                        </Text>
                        <Text style={{ color: couleur.dore, marginBottom: 5, fontSize: 12 }}>Identifiant Contrat (Auto) :</Text>
                        <TextInput
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                borderRadius: 10,
                                padding: 12,
                                color: couleur.doreClair,
                                borderWidth: 1,
                                borderColor: couleur.dore,
                                marginBottom: 12,
                                fontWeight: 'bold'
                            }}
                            value={idContratNouv}
                            editable={false} // L'utilisateur ne peut pas le modifier
                        />

                        {[
                            { placeholder: 'Nom établissement', value: nomNouv,   setter: setNomNouv   },
                            { placeholder: 'Email',             value: emailNouv, setter: setEmailNouv },
                            { placeholder: 'Téléphone',         value: telNouv,   setter: setTelNouv   },
                        ].map((champ) => (
                            <TextInput
                                key={champ.placeholder}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    borderRadius: 10,
                                    padding: 12,
                                    color: couleur.blanc,
                                    borderWidth: 1,
                                    borderColor: 'rgba(201,168,76,0.4)',
                                    marginBottom: 12
                                }}
                                placeholder={champ.placeholder}
                                placeholderTextColor="#ccc"
                                value={champ.value}
                                onChangeText={champ.setter}
                            />
                        ))}
                        {/* menu ville */}
                        <Text style={{ color: couleur.dore, marginBottom: 5, marginLeft: 10, fontWeight:'bold' }}>
                            Ville :
                        </Text>
                        <TouchableOpacity
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderWidth: 1, borderColor: couleur.dore,
                                borderRadius: 20, padding: 14, marginBottom: 20,
                                flexDirection: 'row', justifyContent: 'space-between'
                            }}
                            onPress={() => setMenuVilleOuvert(!menuVilleOuvert)}
                        >
                            <Text style={{ color: '#fff' }}>{ville}</Text>
                            <Text style={{ color: couleur.dore }}>{menuVilleOuvert ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {menuVilleOuvert && (
                            <View style={{
                                backgroundColor: couleur.grey,
                                borderRadius: 15, marginBottom: 20, padding: 10
                            }}>
                                {nomVille.map((item) => (
                                    <TouchableOpacity
                                        key={item}
                                        style={{ 
                                            padding: 12,
                                            borderBottomWidth: item === nomVille[nomVille.length-1] ? 0 : 0.5,
                                            borderBottomColor: couleur.dore, 
                                        }}
                                        onPress={() => { setVille(item); setMenuVilleOuvert(false); }}
                                    >
                                        <Text style={{ color: ville === item ? couleur.doreClair : couleur.blanc }}>
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        <TouchableOpacity
                            style={{
                                backgroundColor: couleur.dore,
                                borderRadius: 12,
                                padding: 14,
                                alignItems: 'center',
                                marginTop: 6
                            }}
                            onPress={()=> ajouterPartenaire({NomEntreprise:nomNouv, Numero_de_telephone:telNouv, Id_contrat:idContratNouv} as Partenaire)}
                            
                        >
                            <Text style={{ color: couleur.marine, fontWeight: 'bold', fontSize: 16 }}>
                                Enregistrer
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View></ScrollView>
            </Modal>

        </ScrollView>
    )
}