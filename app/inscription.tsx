import { useEffect, useState} from "react"
import {View,Text,TextInput,TouchableOpacity,ImageBackground,Animated,ScrollView, ActivityIndicator} from 'react-native'
import { router} from 'expo-router'
import { createUserWithEmailAndPassword} from 'firebase/auth'
import { doc, getDoc,setDoc,collection,query,where,getDocs,updateDoc,Timestamp} from 'firebase/firestore'
import { auth, db } from '../firebaseConfig'
import { couleur, utiliserAnimationEntree} from "../constants/animation"

const SEUIL_MINIMAL = 25000

export default function ecranRegister(){
    const [email,setEmail]=useState('');
    const [password,setPassword]=useState('');
    const [erreur,setErreur]=useState('');
    const [chargement,setCharge]=useState(false);
    const [isFocus,setIsFocus]=useState(false); // email
    const [isFocused,setIsFocused]=useState(false);//password
    const [role,setRole]=useState('citoyen');
    const [menuOuvert,setMenuOuvert]=useState(false);
    const [nomResponsable, setNomResponsable] = useState('');
    const [isFocusNomRespo, setIsFocusNomRespo] = useState(false);
    const [codeResponsable, setCodeResponsable] = useState('');
    const [isFocusRespo,setIsFocusRespo]=useState(false);
    const [idContrat, setIdContrat] = useState('');
    const [isFocusContrat,setIsFocusContrat]=useState(false)
    const [NomEntreprise, setNomEntreprise] = useState('');
    const [isFocusEntreprise,setIsFocusEntreprise]=useState(false);
    const [menuQuartierOuvert,setMenuQuartierOuvert]=useState(false);
    const [nomQuartier,setNomQuartier]=useState<{nom:string, ville: string}[]>([])
    const [ville,setVille]=useState('Bafoussam'); //prend la valeur de la ville au click
    const [menuVilleOuvert,setMenuVilleOuvert]=useState(false);
    const [nomVille,setNomVille]=useState<string[]>([])
    const [localisation,setLocalisation]=useState('');
    const [isFocusLocalisation,setIsFocusLocalisation]=useState(false);
    const [quartier,setQuartier]=useState('Choisissez votre quartier!')
    const quartierFiltre=ville===''?[]:nomQuartier.filter(q =>q.ville===ville).map(q=>q.nom);
    const [produits,setProduits]=useState<{
        nom : string;
        prix: string;
        type:'standard' | 'luxe';
        reduction_max: Number;
    }[]>([]); // c'est un tableau qui possede les element ayan les caracteristiques ci dessus [] apres } siginie que ces un tableau ayant ces caracteristiques et ([]) signifie que le tableaux est vide pour l'instant
    const [formulaireOuvert, setFormulaireOuvert] = useState(false);
    const [nomProduit, setNomProduit] = useState('');
    const [prixProduit, setPrixProduit] = useState('');
    const [typeProduit, setTypeProduit] = useState<'standard' | 'luxe'>('standard');
    const [isFocusNomProduit, setIsFocusNomProduit] = useState(false);
    const [isFocusPrixProduit, setIsFocusPrixProduit] = useState(false);
    const [indexModification, setIndexModification] = useState<number | null>(null);
    const { animation, progression, demarrerEntree, demarrerProgression, arreterProgression } = utiliserAnimationEntree()
    const [verifieID,setVerifieID]=useState(false)

    const [verifiant, setVerifiant] = useState(false);
    const [codeTrouve, setCodeTrouve] = useState(false);
    const echelleBouton=useState(new Animated.Value(1))[0];
    const [idDocPartenaire, setIdDocPartenaire] = useState('');
    const [idDocRespo, setIdDocRespo] = useState('');


    useEffect(function() { //dit a react execute ce code apres que l'ecran s'affiche
        chargeDonnee()

    }, [])
    // États pour l'animation
    // 1. Remplace ta fonction testerCodeContrat par celle-ci
    async function testerCodeContrat(codeSaisi: string) {
        if (!codeSaisi || NomEntreprise === '') {
            afficherErreurTemporaire("Saisis d'abord le nom de l'entreprise et l'ID.");
            return;
        }
        setVerifiant(true);
        try {
            const q = query(collection(db, 'partenaires'), 
                        where('Id_contrat', '==', codeSaisi),
                        where('email', '==', email));
            
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docPartenaire = querySnapshot.docs[0];
                setIdDocPartenaire(docPartenaire.id); // <--- ON SAUVEGARDE L'ID DU DOCUMENT ICI
                setTimeout(() => {
                    setVerifiant(false);
                    setCodeTrouve(true); // Déclenche le 👍
                    setVerifieID(true);   // Autorise l'inscription
                    Animated.sequence([
                    Animated.spring(echelleBouton,{toValue:1, useNativeDriver:true}), Animated.spring(echelleBouton, {toValue:1, useNativeDriver:true})
                ]).start();
                }, 800);
            } else {
                setVerifiant(false);
                afficherErreurTemporaire("ID ou Nom d'entreprise incorrect.");
            }
        } catch (e: any) {
            setVerifiant(false);
            alert(e.message);
        }
    }

    async function chargeDonnee(){
        try{
            const snapshotVilleQuatier= await getDoc(doc(db,'configuration','zones'))
            if(snapshotVilleQuatier.exists()){
                setNomVille(snapshotVilleQuatier.data().villes || [])
                setNomQuartier(snapshotVilleQuatier.data().quartiers || [])
            }
        }
        catch(e:any){
            alert(e.message)
            console.log(e.message)
        }
    }

    async function verifierIdContrat() {
        if(idContrat==''){
            afficherErreurTemporaire('Entre l\'Id du contrat')
            return
        }
        setCharge(true);
        demarrerProgression();
        try {
            const q = query(collection(db, 'partenaires'), where('Id_contrat', '==', idContrat));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                afficherErreurTemporaire("ID de contrat invalide.");
                setVerifieID(false);
            } else {
                const donnees = snapshot.docs[0].data();
                if (donnees.statut === 'refuse') {
                    afficherErreurTemporaire("Demande refusée. Contactez Hyzakam.");
                } else if (donnees.statut === 'valide') {
                    alert("ID validé !");
                    setVerifieID(true);
                } else {
                    afficherErreurTemporaire("Demande en attente de validation.");
                }
            }
        } catch (e: any) {
            alert(e.message);
        }
        setCharge(false);
        arreterProgression();
    }


    async function Inscrire() {
        const nombreLuxe=produits.filter(p=> p.type==='luxe').length
        if (email === '' || password === '') {
            afficherErreurTemporaire('Remplis tous les champs.')
            return
        }
        if (role==='etablissement' && verifieID===false){
            afficherErreurTemporaire("entrer l'ID du contrat ")
            return
        }
        if ( (role==='citoyen') &&(!quartierFiltre.includes(quartier) || quartier==='Choisissez votre quartier!') ) {
            afficherErreurTemporaire("Choisissez votre quartier") 
            return
        }
        // Vérifications selon le rôle
        if (role === 'responsable' && codeResponsable === '') {
            afficherErreurTemporaire('Entre le code envoyé par Hyzakam.')
            return
        }
        if (role === 'responsable' && nomResponsable === '') {
            afficherErreurTemporaire('Entre ton nom complet.')
            return
        }
        if (role === 'etablissement' && NomEntreprise === '') {
            afficherErreurTemporaire('Entre le nom de ton établissement.')
            return
        }
        if (role === 'etablissement' && produits.length < 5) {
            afficherErreurTemporaire('Tu dois entrer au minimum 5 produits.')
            return
        }
        if (role === 'etablissement' && nombreLuxe < 2) {
            afficherErreurTemporaire('Tu dois avoir au minimum 2 produits luxe.')
            return
        }
        setCharge(true)
        demarrerProgression()

        try {
            // ÉTAPE 1 — Vérifier le code AVANT de créer le compte
            const qEmail = query(collection(db, 'utilisateurs'), where('email', '==', email.trim()));
            const emailSnapshot = await getDocs(qEmail);

            if (!emailSnapshot.empty) {
                afficherErreurTemporaire("Cet e-mail est déjà utilisé par un autre compte.");
                setCharge(false); 
                arreterProgression(); 
                return; // On arrête tout ici
            }

            if (role === 'responsable') {
                const codeAVerifier = codeResponsable
                
                const q = query( 
                    collection(db, 'RespoID'), //vas dans la colection RespoID
                    where('code_secret', '==', codeAVerifier), // recuppere tout les documents de la collection qui possede le mm code secret entrer par lutilisateurs
                )
                const snapshot = await getDocs(q) // stocke toute les informations trouver dans l'objet snapshot

                if (snapshot.empty) {
                    afficherErreurTemporaire('Code invalide.')
                    setCharge(false)
                    arreterProgression()
                    return
                }
                const docSnap = snapshot.docs[0];
                const dataRespo = docSnap.data();

                // VÉRIFICATION DE L'EMAIL (Sécurité cruciale)
                if (dataRespo.email.trim()!== email.trim()) {
                    afficherErreurTemporaire("Ce code ne correspond pas à votre e-mail.");
                    setCharge(false); arreterProgression(); return;
                }

                // VÉRIFICATION SI DÉJÀ UTILISÉ
                if (dataRespo.utilise === true) {
                    afficherErreurTemporaire("Ce code a déjà servi pour une inscription.");
                    setCharge(false); arreterProgression(); return;
                }
            }
            if (role === 'etablissement') {

                if (!idContrat) {
                    setErreur("Veuillez entrer l'ID du contrat");
                    setCharge(false);
                    return;
                }

                // Vérification du contrat
                const contratRef = doc(db, 'partenaires', idContrat);
                const contratSnap = await getDoc(contratRef);

                if (!contratSnap.exists() || contratSnap.data().statut !== 'valide') {
                    setErreur("ID de contrat invalide ou non valide");
                    setCharge(false);
                    return;
                }

                console.log("✅ Établissement créé avec succès - montantContrat = 25000 FCFA");
            }
            // Créer le compte Firebase Auth

            const resultat = await createUserWithEmailAndPassword(auth, email, password)
            const uid = resultat.user.uid

            // ÉTAPE 3 — Créer le document utilisateur avec le rôle du formulaire
            await setDoc(doc(db,'utilisateurs',uid),{
                email: email.trim(),
                nom:role==='etablissement'?NomEntreprise:
                    role==='responsable'? nomResponsable:'',
                role:role,
                ville: role!=='responsable'?ville:'',
                point:0,
                id_document_respo: role==='responsable'? idDocRespo:(role==='etablissement'?idDocPartenaire:''), // <--- INDISPENSABLE pour la Rule
                quartier: role==='citoyen'? quartier:'',
                date_creation:Timestamp.now(),
            })

            if (role === 'etablissement') {
                const produitsStandard = produits
                    .filter(p => p.type === 'standard')
                    .map(p => ({
                        nom: p.nom,
                        prix: parseInt(p.prix),
                        reduction_max: p.reduction_max,
                    }))

                const produitsLuxe = produits
                    .filter(p => p.type === 'luxe')
                    .map(p => ({
                        // .filter() garde seulement les produits du bon type. Ensuite .map() transforme chaque produit pour ne garder que les champs nécessaires dans Firebase :
                        nom: p.nom,
                        prix: parseInt(p.prix),
                        reduction_max: p.reduction_max,
                    }))
                
                const maintenant=role==='etablissement'?Timestamp.now():''
                await setDoc(doc(db, 'etablissements', uid), {
                    id_etablissement: uid,
                    id_contrat:idContrat,
                    id_document_partenaire: idDocPartenaire, // <--- ON ENVOIE L'ID À LA RULE
                    nom: NomEntreprise,
                    ville: ville,
                    localisation: localisation,
                    produit_standard: produitsStandard,
                    produit_luxe: produitsLuxe,
                    montantContrat:role==='etablissement'?SEUIL_MINIMAL:0,
                    dateRenouvellement:maintenant,
                    createAt:maintenant,
                    updateAt:maintenant,
                })
            }
            // Après la création de l'établissement
            const vercelUrl = "https://cashback-proprete-pjiz0pwuj-matchimvanel-gifs-projects.vercel.app/api/update-montant-contrat";

            fetch(vercelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
            })
            .then(res => res.json())
            .then(data => console.log("Renouvellement vérifié :", data))
            .catch(err => console.log("Erreur renouvellement :", err));
            // ÉTAPE 4 — Marquer le code comme utilisé
            if (role === 'responsable') {
                const codeAVerifier =codeResponsable
                const q = query(
                    collection(db, 'RespoID'),
                    where('code_secret', '==', codeAVerifier)
                ) // on veriie sil existe un document avec le code l'utilisateur et on change utilise de false a true 
                const snapshot = await getDocs(q)
                await updateDoc(snapshot.docs[0].ref, { utilise: true })
            }

            // ÉTAPE 5 — Rediriger selon le rôle
            if (role === 'citoyen')       router.replace('/(tabs)/citoyen')
            if (role === 'responsable')   router.replace('/(tabs)/responsable')
            if (role === 'etablissement') router.replace('/(tabs)/etablissement')

        } catch (e: any) {
            // Si l'écriture échoue, on nettoie le compte Auth créé juste avant
            if (e.code === 'permission-denied' && auth.currentUser) {
                await auth.currentUser.delete();
            }
            // Gestion des messages d'erreur
            if (e.code === 'auth/email-already-in-use') {
                afficherErreurTemporaire('Cet email est déjà utilisé.');
            } else {
                afficherErreurTemporaire(e.message);
            }
            if (e.code === 'auth/email-already-in-use')     afficherErreurTemporaire('Cet email est déjà utilisé.')
            if (e.code === 'auth/weak-password')            afficherErreurTemporaire('Mot de passe trop court. Minimum 6 caractères.')
            if (e.code === 'auth/network-request-failed')   afficherErreurTemporaire('Pas de connexion internet.')
            if (e.code === 'auth/too-many-requests')        afficherErreurTemporaire('Trop de tentatives. Réessaie plus tard.')
            if(e.code==='auth/invalid-email') afficherErreurTemporaire('entrer une addresse email valide')
            if(e.code==='auth/email-already-in-use') afficherErreurTemporaire('Cet email est déjà utilisé.')
            if(e.code==='auth/invalid-email') afficherErreurTemporaire('entrer une adresse email valide')
            else{
                afficherErreurTemporaire(e.message)
            }
        }

        setCharge(false)
        arreterProgression()
    }
    function seConnecter(){
        router.push('/login')
    }
    function afficherErreurTemporaire(message:string){
        setErreur(message)
        setTimeout(function(){
            setErreur('')},3000)
    }
    function affiche_erreur(){
        if(erreur!=''){
            return(
                    <Text 
                    style={{ 
                        color: couleur.erreur, textAlign: 'center',
                        marginBottom: 10 }}>    
                        {erreur}
                    </Text>
            );
        }
        else{
                return null;
        }
    }
    useEffect(function(){
        demarrerEntree()
    },([]))
    function ajouterProduit(){
        if(nomProduit===''){
            afficherErreurTemporaire("Entre le nom du produit.");
            return
        }
        const prixNombre = parseInt(prixProduit);
        if(isNaN(prixNombre) || prixNombre<=0){
            afficherErreurTemporaire("Entre un prix valide.");
            return
        }
        const reductionMax= calculerReductionMax(prixNombre);
        if(reductionMax<25){
            afficherErreurTemporaire("Prix trop bas entrer minimum 75 FCFA")
            return
        }
        // Vérifier si le nom existe déjà dans la liste sauf si cest l mm produit quon modifie
        const nomExisteDeja = produits.some((p, i) =>
        normaliserNom(p.nom) === normaliserNom(nomProduit) && i !== indexModification
        )
        if (nomExisteDeja) {
            afficherErreurTemporaire('Un produit avec ce nom existe déjà.')
            return
        }
        if (typeProduit === 'luxe') {
            const prixMaxStandard = Math.max(
                ...produits
                    .filter(p => p.type === 'standard')
                    .map(p => parseInt(p.prix))
            )
            if (produits.filter(p => p.type === 'standard').length > 0 && prixNombre <= prixMaxStandard) {
                afficherErreurTemporaire('Le prix d un produit luxe doit être supérieur à tous les prix standard.')
                return
            }
        }
        if(indexModification!==null){
            // MODE MODIFICATION — remplacer le produit existant
            const nouveauxProduits = [...produits] 
            // {* ...produits signifie copie tout ce u'il y avait dans le tableau et ajoute en derniere position produits*}
            nouveauxProduits[indexModification] = {
                nom: nomProduit,
                prix: prixProduit,
                type: typeProduit,
                reduction_max: reductionMax,
            }
            setProduits(nouveauxProduits)
            setIndexModification(null)
        } 
        else {
            // MODE AJOUT — ajouter un nouveau produit
            setProduits([...produits, {
                nom: nomProduit,
                prix: prixProduit,
                type: typeProduit,
                reduction_max: reductionMax,
            }])
        }
        setNomProduit('');
        setPrixProduit('');
        setTypeProduit('standard');
        setFormulaireOuvert(false);
    }

    function calculerReductionMax(prix:number):number {
        const tiers= Math.floor(prix/3);
        return Math.floor(tiers/25)*25;
    }
    function normaliserNom(texte: string): string {
        return texte
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9àâäéèêëîïôöùûüç ]/g, '')
    }

    function 
    renduChampResponsable() {
        const doitMonter = isFocusRespo || codeResponsable !== '';
        if (role !== 'responsable') return null; // Si pas responsable, on n'affiche rien

        else
        {
            return(
                <>  <View style={{ marginBottom: 20, marginTop: 10 }}>
                        <Text style={{
                            position: 'absolute',
                            left: 8,
                            top: isFocusNomRespo || nomResponsable !== '' ? -25 : 15,
                            fontSize: isFocusNomRespo || nomResponsable !== '' ? 14 : 15,
                            color: isFocusNomRespo || nomResponsable !== '' ? couleur.dore : '#ccc',
                            zIndex: 1,
                            paddingHorizontal: 5,
                            fontWeight: isFocusNomRespo || nomResponsable !== '' ? 'bold' : 'normal'
                        }}>
                            Nom complet
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderWidth: 1,
                                borderColor: !isFocusNomRespo ? couleur.dore : 'transparent',
                                borderRadius: 20, padding: 14, color: '#fff'
                            }}
                            value={nomResponsable}
                            onChangeText={setNomResponsable}
                            onFocus={() => setIsFocusNomRespo(true)}
                            onBlur={() => setIsFocusNomRespo(false)}
                            allowFontScaling={false} />
                    </View>
                    <View style={{ marginBottom: 20, marginTop: 10 }}>
                        <Text style={{
                            position: 'absolute',
                            left: 8,
                            top: doitMonter ? -25 : 15,
                            fontSize: doitMonter ? 14 : 15,
                            color: doitMonter ? couleur.dore : '#ccc',
                            zIndex: 1,
                            paddingHorizontal: 5,
                            fontWeight: doitMonter ? 'bold' : 'normal'
                        }}>
                            Code envoyé par Hyzakam
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderWidth: 1,
                                borderColor: isFocusRespo ? 'transparent' : couleur.dore,
                                borderRadius: 20, padding: 14, color: '#fff'
                            }}
                            value={codeResponsable}
                            onChangeText={setCodeResponsable}
                            onFocus={function () { setIsFocusRespo(true) } }
                            onBlur={function () { setIsFocusRespo(false) } }
                            allowFontScaling={false} />
                    </View>
                </>
            );
        }
    }
    function renduChampCitoyen(){
        if (role!=='citoyen'){
            return null
        }
        else{
            return(
               <>
                    {/* Ville */}
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
                            backgroundColor: 'rgba(41, 79, 120, 0.9)',
                            borderRadius: 15, marginBottom: 20, padding: 10
                        }}>
                            {nomVille.map((item) => (
                                <TouchableOpacity
                                    key={item}
                                    style={{ 
                                        padding: 12,
                                        borderBottomWidth: item === nomVille[nomVille.length-1] ? 0 : 0.5,
                                        borderBottomColor: 'rgba(255,255,255,0.2)' 
                                    }}
                                    onPress={() => { setVille(item);setQuartier('Choisissez votre quartier!'); setMenuVilleOuvert(false); }}
                                >
                                    <Text style={{ color: ville === item ? couleur.doreClair : couleur.blanc }}>
                                        {item}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {/* quartier */}
                    <TouchableOpacity 
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            borderWidth: 1,
                            borderColor: couleur.dore,
                            borderRadius: 20,
                            padding: 14,
                            marginBottom: 20,
                            flexDirection: 'row', //force les elements a etre sur la mm ligne (citoyen et la fleche bizare)
                            justifyContent: 'space-between'
                        }}
                        onPress={() => setMenuQuartierOuvert(!menuQuartierOuvert)}
                    >
                        <Text style={{ color: '#fff' }}>
                            {quartier}
                        </Text>
                        <Text style={{ color: couleur.dore }}>{menuQuartierOuvert ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {/* Liste des options (s'affiche seulement si menuOuvert est vrai) */}
                    {menuQuartierOuvert && ( // si menuOuvert===true alors affiche ce qui est apres &&( mais si menOuvert===false on affiche rien
                        <View style={{ 
                            backgroundColor: 'rgba(41, 79, 120, 0.9)', 
                            borderRadius: 15, 
                            marginBottom: 20,
                            padding: 10,
                        }}>
                            {quartierFiltre.map((item) => ( //cree un bouton cliquable de mm style pour chaque items (citoyen,responsable,etablissement) et items est un nom choisi aux hasard elle est emporaire et est asocier au valeurs du tableaux
                                <TouchableOpacity 
                                    key={item}
                                    style={{ padding: 12, borderBottomWidth: item === quartierFiltre[quartierFiltre.length-1]? 0 : 0.5, borderBottomColor: 'rgba(255,255,255,0.2)'}}
                                    onPress={() => {
                                        setQuartier(item);
                                        setMenuQuartierOuvert(false);
                                    }}
                                >
                                    <Text style={{ color: quartier === item? couleur.doreClair : couleur.blanc, fontWeight: quartier === item? 'bold' : 'normal' }}>
                                        {item.charAt(0).toUpperCase() + item.slice(1)}
                                        {/*charAt(0) prend le 1er caractere du mot
                                            toUpperCase() met en majuscule le caractere pris par chartArt
                                            +item.slice(1) concatene le restedu mot a la majuscule */}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
               </>     
            )
        }
    }
    function renduChampEtablissement() {
        const doitMonter = isFocusContrat || idContrat !== '';
        const doitMonterNom= isFocusEntreprise|| NomEntreprise!=='';
        const doitMonterLocalisation = isFocusLocalisation || localisation !== '';
        const nombreLuxe = produits.filter(p => p.type === 'luxe').length; // nombreLuxe conserve le nombre dl'element de type luxe stocker dans produit et pour naviguer dans la liste on utilise .filter ou' p vas prendre temporairement les valeurs de produits puis veririfier si son type est 'luxe' hy 
        const nombreStandard = produits.filter(p => p.type === 'standard').length;
        if (role !== 'etablissement') return null;
        else
        {
            return (
                <><View style={{ marginBottom: 20, marginTop: 10 }}>
                    <Text style={{
                        position: 'absolute',
                        left: 8,
                        top: doitMonterNom ? -25 : 15,
                        fontSize: doitMonterNom ? 14 : 15,
                        color: doitMonterNom ? couleur.dore : '#ccc',
                        zIndex: 1,
                        paddingHorizontal: 5,
                        fontWeight: doitMonterNom ? 'bold' : 'normal'
                    }}>
                        Nom de l'etablissement 
                    </Text>
                    <TextInput
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            borderWidth: 1,
                            borderColor: isFocusEntreprise? 'transparent':couleur.dore,
                            borderRadius: 20, padding: 14, color: '#fff'
                        }}
                        value={NomEntreprise}
                        onChangeText={setNomEntreprise}
                        onFocus={function () { setIsFocusEntreprise(true) } }
                        onBlur={function () { setIsFocusEntreprise(false) } }
                        allowFontScaling={false} />
                </View>
                <View style={{ marginBottom: 20, marginTop: 10 }}>
                        <Text style={{
                            position: 'absolute',
                            left: 8,
                            top: doitMonter ? -25 : 15,
                            fontSize: doitMonter ? 14 : 15,
                            color: doitMonter ? couleur.dore : '#ccc',
                            zIndex: 1,
                            paddingHorizontal: 5,
                            fontWeight: doitMonter ? 'bold' : 'normal'
                        }}>
                            ID fourni par hyzakam
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TextInput
                                style={{
                                    flex: 1,
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    borderWidth: 1,
                                    borderColor: isFocusContrat ? 'transparent' : couleur.dore,
                                    borderRadius: 20, padding: 14, color: '#fff'
                                }}
                                value={idContrat}
                                onChangeText={setIdContrat}
                                onFocus={function () { setIsFocusContrat(true) }}
                                onBlur={function () { setIsFocusContrat(false) }}
                                allowFontScaling={false}
                            />
                            <TouchableOpacity
                                style={{
                                    backgroundColor: verifieID ? couleur.turquoise : couleur.dore,
                                    borderRadius: 15,
                                    padding: 2,
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onPress={verifierIdContrat}
                            >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Animated.View style={{transform:[{scale:echelleBouton}]}}>
                                            <TouchableOpacity 
                                                onPress={() => testerCodeContrat(idContrat)}
                                                style={{
                                                    backgroundColor: codeTrouve ? couleur.turquoise : couleur.dore,
                                                    padding: 12, borderRadius: 15, minWidth: 80, alignItems: 'center',elevation:codeTrouve?10:0
                                                }}
                                            >
                                                {verifiant ? (
                                                    <ActivityIndicator size="large" color={couleur.dore} style={{ marginTop: 50 }}/>
                                                ) : (
                                                    <Text style={{ fontWeight: 'bold', color: couleur.marine }}>
                                                        {codeTrouve ? "👍OK" : "verifier"}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        </Animated.View>
                                        
                                    </View>
                            </TouchableOpacity>
                        </View>
                        
                    </View>
                        
                        {/* Ville */}
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
                                backgroundColor: 'rgba(41, 79, 120, 0.9)',
                                borderRadius: 15, marginBottom: 20, padding: 10
                            }}>
                                {nomVille.map((item) => (
                                    <TouchableOpacity
                                        key={item}
                                        style={{ 
                                            padding: 12,
                                            borderBottomWidth: item === nomVille[nomVille.length-1] ? 0 : 0.5,
                                            borderBottomColor: 'rgba(255,255,255,0.2)' 
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

                        {/* Localisation */}
                        <View style={{ marginBottom: 20, marginTop: 10 }} >
                            <Text style={{
                                position: 'absolute', left: 8,
                                top: doitMonterLocalisation ? -25 : 15,
                                fontSize: doitMonterLocalisation ? 14 : 15,
                                color: doitMonterLocalisation ? couleur.dore : '#ccc',
                                zIndex: 1, paddingHorizontal: 5,
                                fontWeight: doitMonterLocalisation ? 'bold' : 'normal',
                            }} >
                                Localisation de ta boutique :
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    borderWidth: 1,
                                    borderColor: isFocusLocalisation ? 'transparent':couleur.dore,
                                    borderRadius: 20, padding: 14, color: '#fff'
                                }}
                                value={localisation}
                                onChangeText={setLocalisation}
                                onFocus={() => setIsFocusLocalisation(true)}
                                onBlur={() => setIsFocusLocalisation(false)}
                                allowFontScaling={false}
                            />
                        </View>

                        {/* Titre */}
                        <Text style={{ color: couleur.dore, marginBottom: 10, marginLeft: 10, fontWeight: 'bold' }}>
                            Mes produits :
                        </Text>

                        {/* Compteur */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                            <Text style={{ color: nombreStandard >= 12 ? couleur.turquoise : '#ccc', fontSize: 13 }}>
                                {nombreStandard} standard
                            </Text>
                            <Text style={{ color: nombreLuxe >= 3 ? couleur.turquoise : '#ccc', fontSize: 13 }}>
                                {nombreLuxe} luxe
                            </Text>
                            <Text style={{ color: produits.length >= 15 ? couleur.turquoise : '#ccc', fontSize: 13 }}>
                                Total : {produits.length}/5 minimum
                            </Text>
                        </View>
                        {/* Liste des produits */}
                        {produits.map((produit, index) => (
                            <View key={index}
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    borderRadius: 15, padding: 12, marginBottom: 10,
                                    flexDirection: 'column', justifyContent: 'space-between',
                                    alignItems: 'center', gap:10
                                }}
                            >
                                <View style={{flexDirection:'row',gap:15}}>
                                    <View style={{gap:20}}>
                                        <Text style={{ color: couleur.marine, fontWeight: 'bold', fontSize:17 }}>
                                            {produit.nom} : {produit.prix} FCFA
                                        </Text>
                                        <Text style={{ color: '#ccc', fontSize: 15 }}>
                                            Réduction max : {produit.reduction_max.toString()} FCFA
                                        </Text>
                                    </View>

                                    <View style={{ alignItems: 'flex-end', gap:12 }}>
                                        <Text style={{
                                            color: produit.type === 'luxe' ? couleur.doreClair : couleur.turquoise,
                                            fontSize: 14, fontWeight: 'bold',marginRight:7
                                        }}>
                                            {produit.type === 'luxe' ? '⭐ Luxe' : 'Standard'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{flexDirection:'row', gap:17, alignContent:'space-between'}}>
                                    <TouchableOpacity onPress={() => {
                                    setProduits(produits.filter((_, i) => i !== index))
                                    }}
                                    style={{alignContent:'center',justifyContent:'center'}}
                                    >
                                        <Text style={{ 
                                            fontWeight:'bold',
                                            backgroundColor:couleur.marine,
                                            color: couleur.doreClair, 
                                            fontSize: 15, 
                                            marginTop: 4,
                                            borderWidth: 1, 
                                            borderColor: '#1f1d1d',
                                            borderRadius: 20, 
                                            padding: 14, 
                                            marginBottom: 5,
                                            textAlign:'center',
                                            width:'100%' }}>
                                            Supprimer
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        setNomProduit(produit.nom)
                                        setPrixProduit(produit.prix)
                                        setTypeProduit(produit.type)
                                        setIndexModification(index)
                                        setFormulaireOuvert(true)
                                    }}
                                    style={{alignContent:'center',justifyContent:"center"}}
                                    >
                                         {/* // ici je veux qu'au click on puisse Modifier le produit qu es dans la liste des produits */}
                                        <Text style={{ 
                                            fontWeight:'bold',
                                            backgroundColor:couleur.marine,
                                            color: couleur.doreClair, 
                                            fontSize: 15, 
                                            marginTop: 4,
                                            borderWidth: 1, 
                                            borderColor: '#1f1d1d',
                                            borderRadius: 20, 
                                            padding: 14, 
                                            marginBottom: 5 ,
                                            textAlign:'center',
                                            width:'100%' }}>
                                            Modifier 
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        {/* Bouton ajouter */}
                        <TouchableOpacity
                            style={{
                                borderWidth: 3, borderColor: couleur.dore,
                                borderRadius: 20, padding: 12, marginBottom: 20,
                                alignItems: 'center'
                            }}
                            onPress={() => setFormulaireOuvert(!formulaireOuvert)}
                        >
                            <Text style={{ color: couleur.dore, fontWeight: 'bold' }}>
                                {formulaireOuvert ? '✕ Fermer' : '+ Ajouter un produit'}
                            </Text>
                            {/* formulaire dajout des produits */}
                        </TouchableOpacity>
                        {formulaireOuvert && (
                            <View style={{
                                backgroundColor: 'rgba(41, 79, 120, 0.9)',
                                borderRadius: 20, padding: 20, marginBottom: 20
                            }}>

                                {/* Nom du produit */}
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{
                                        position: 'absolute', left: 8,
                                        top: isFocusNomProduit || nomProduit !== '' ? -20 : 14,
                                        fontSize: isFocusNomProduit || nomProduit !== '' ? 13 : 15,
                                        color: isFocusNomProduit || nomProduit !== '' ? couleur.dore : '#ccc',
                                        zIndex: 1, paddingHorizontal: 5,
                                    }}>
                                        Nom du produit
                                    </Text>
                                    <TextInput
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                            borderWidth: 1,
                                            borderColor: isFocusNomProduit ? couleur.dore : 'transparent',
                                            borderRadius: 15, padding: 12, color: '#fff'
                                        }}
                                        value={nomProduit}
                                        onChangeText={setNomProduit}
                                        onFocus={() => setIsFocusNomProduit(true)}
                                        onBlur={() => setIsFocusNomProduit(false)}
                                        allowFontScaling={false}
                                    />
                                </View>

                                {/* Prix du produit */}
                                <View style={{ marginBottom: 15 }}>
                                    <Text style={{
                                        position: 'absolute', left: 8,
                                        top: isFocusPrixProduit || prixProduit !== '' ? -20 : 14,
                                        fontSize: isFocusPrixProduit || prixProduit !== '' ? 13 : 15,
                                        color: isFocusPrixProduit || prixProduit !== '' ? couleur.dore : '#ccc',
                                        zIndex: 1, paddingHorizontal: 5,
                                    }}>
                                        Prix (FCFA)
                                    </Text>
                                    <TextInput
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                            borderWidth: 1,
                                            borderColor: isFocusPrixProduit ? couleur.dore : 'transparent',
                                            borderRadius: 15, padding: 12, color: '#fff'
                                        }}
                                        value={prixProduit}
                                        onChangeText={setPrixProduit}
                                        onFocus={() => setIsFocusPrixProduit(true)}
                                        onBlur={() => setIsFocusPrixProduit(false)}
                                        keyboardType="numeric"
                                        allowFontScaling={false}
                                    />
                                </View>

                                {/* Réduction max calculée */}
                                {prixProduit !== '' && parseInt(prixProduit) >= 75 && (
                                    <Text style={{ color: couleur.turquoise, marginBottom: 15, marginLeft: 10 }}>
                                        Réduction max : {calculerReductionMax(parseInt(prixProduit)).toString()} FCFA
                                    </Text>
                                )}

                                {/* Choix Standard ou Luxe */}
                                <Text style={{ color: couleur.dore, marginBottom: 10, fontWeight: 'bold' }}>
                                    Type de produit :
                                </Text>
                                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', marginRight: 30 }}
                                        onPress={() => setTypeProduit('standard')}
                                    >
                                        <View style={{
                                            width: 20, height: 20, borderRadius: 10,
                                            borderWidth: 2, borderColor: couleur.turquoise,
                                            backgroundColor: typeProduit === 'standard' ? couleur.turquoise : 'transparent',
                                            marginRight: 8
                                        }} />
                                        <Text style={{ color: '#fff' }}>Standard</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                        onPress={() => setTypeProduit('luxe')}
                                    >
                                        <View style={{
                                            width: 20, height: 20, borderRadius: 10,
                                            borderWidth: 2, borderColor: couleur.doreClair,
                                            backgroundColor: typeProduit === 'luxe' ? couleur.doreClair : 'transparent',
                                            marginRight: 8
                                        }} />
                                        <Text style={{ color: '#fff' }}>⭐ Luxe</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Bouton confirmer */}
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: couleur.dore,
                                        borderRadius: 15, padding: 12, alignItems: 'center'
                                    }}
                                    onPress={ajouterProduit}
                                >
                                    <Text style={{ color: couleur.marine, fontWeight: 'bold' }}>
                                        {indexModification !== null ? 'Modifier le produit' : 'Confirmer le produit'}
                                    </Text>
                                </TouchableOpacity>

                            </View>
                        )}
                    </>
            );
        }
    }

    function renduBouton() {
        if (chargement===true) {
            return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: couleur.marine, opacity: 0.7, marginBottom: 8 }}>
                        Vérification en cours...
                    </Text>
                    <View style={{
                        width: '100%', height: 6,
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: 10, overflow: 'hidden'
                    }}>
                        <Animated.View style={{
                            height: 6,
                            borderRadius: 10,
                            backgroundColor: couleur.marine,
                            width: progression.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%']
                            })
                        }} />
                        </View>
                </View>
            )
        }
        else{
            return (
                <Text style={{color: couleur.marine, fontSize:16, fontWeight:'bold', textAlign:'center'}}>
                    Inscription
                </Text>
            )
        }
    }
    if (chargement) {
            return  <ActivityIndicator size="large" color={couleur.dore} style={{ marginTop: '30%' }} />
        }
    return (
            <ImageBackground
                source={require('../assets/images/papier-abstrait-coupe-conception-art-pour-modele-affiche-resume-modele_41204-8981.jpg')}
                resizeMode="cover"
                style={{ flex: 1,
                         height: '100%',
                         width:'100%',}}
            >
                <ScrollView contentContainerStyle={{flexGrow:1}}>
                    {/* Tout ton contenu ici à l'intérieur */}
                    <Animated.View style={{
                    flex: 1,
                    justifyContent: 'center',
                    paddingHorizontal: 28,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    opacity: animation.interpolate({
                        inputRange:[0,500],
                        outputRange:[1,0]})
                    }}>

                        <Text style={{ 
                            color: couleur.doreClair, fontSize: 26, 
                            fontWeight: 'bold', 
                            textAlign: 'center', marginBottom: 10, marginTop:'50%' }}
                            allowFontScaling={false}>
                            {/* allowFontscaling sert a obliger le telephone a utiliser les polices et tailles disposer dans le code */}
                                Cashback de Propreté
                        </Text>

                        <Text style={{ 
                            color: couleur.turquoise, fontSize: 15, 
                            textAlign: 'center', marginBottom: 40, 
                            letterSpacing: 2 }} allowFontScaling={false}>
                                Inscription
                        </Text>
                        <View style={{marginBottom:20}}>
                            <Text style={{
                                position:'absolute',
                                left:8,
                                top: (isFocus||email!=='')? -30:15,
                                fontSize : (isFocus||email!=='')? 20:15,
                                color:(isFocus||email!=='')? couleur.dore:'#ccc',
                                zIndex:1,
                                paddingHorizontal: 5,
                            }}>
                                Address email
                            </Text>
                            <TextInput
                                style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.15)', 
                                    borderWidth: 1, 
                                    borderColor: isFocus? 'transparent':couleur.dore , 
                                    borderRadius: 20, 
                                    padding: 14, 
                                    fontSize: 15, 
                                    color: '#fff',}}
                                value={email}
                                onChangeText={setEmail}
                                onFocus={()=>setIsFocus(true)}
                                onBlur={()=>setIsFocus(false)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                allowFontScaling={false}
                            />
                        </View>
                        
                        <View style={{marginBottom:20,
                                    marginTop:10,
                        }}>
                            <Text style={{
                                position:'absolute',
                                left:8,
                                top: (isFocused||password!=='')? -30:15,
                                fontSize : (isFocused||password!=='')? 20:15,
                                color:(isFocused||password!=='')? couleur.dore:'#ccc',
                                zIndex:1, 
                                // maintenir le texte en haut zIndex
                                backgroundColor:(isFocused||password!=='')? 'rgba(0, 0, 0, 0)':'transparent',
                                paddingHorizontal: 5,
                            }}>
                                Mot de passe 
                            </Text>
                            <TextInput
                                style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.15)', 
                                    borderWidth: 1, 
                                    borderColor: isFocused? 'transparent':couleur.dore , 
                                    borderRadius: 20, 
                                    padding: 14, 
                                    fontSize: 15, 
                                    color: '#fff',}}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={()=>setIsFocused(true)}
                                onBlur={()=>setIsFocused(false)}
                                autoCapitalize="none"
                                allowFontScaling={false}
                            />
                        </View>

                        {/* Titre du menu */}
                        <Text style={{ color: couleur.dore, marginBottom: 5, marginLeft: 10, fontWeight:'bold' }}>
                            Je m'inscris en tant que :
                        </Text>

                        {/* Bouton du menu */}
                        <TouchableOpacity 
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderWidth: 1,
                                borderColor: couleur.dore,
                                borderRadius: 20,
                                padding: 14,
                                marginBottom: 20,
                                flexDirection: 'row', //force les elements a etre sur la mm ligne (citoyen et la fleche bizare)
                                justifyContent: 'space-between'
                            }}
                            onPress={() => setMenuOuvert(!menuOuvert)}
                        >
                            <Text style={{ color: '#fff' }}>
                                {role === 'citoyen' ? 'Citoyen' : 
                                role === 'responsable' ? 'Responsable Propreté' : 
                                'Établissement / Partenaire'}
                            </Text>
                            <Text style={{ color: couleur.dore }}>{menuOuvert ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {/* Liste des options (s'affiche seulement si menuOuvert est vrai) */}
                        {menuOuvert && ( // si menuOuvert===true alors affiche ce qui est apres &&( mais si menOuvert===false on affiche rien
                            <View style={{ 
                                backgroundColor: 'rgba(41, 79, 120, 0.9)', 
                                borderRadius: 15, 
                                marginBottom: 20,
                                padding: 10 
                            }}>
                                {['citoyen', 'responsable', 'etablissement'].map((item) => ( //cree un bouton cliquable de mm style pour chaque items (citoyen,responsable,etablissement) et items est un nom choisi aux hasard elle est emporaire et est asocier au valeurs du tableaux
                                    <TouchableOpacity 
                                        key={item}
                                        style={{ padding: 12, borderBottomWidth: item === 'etablissement' ? 0 : 0.5, borderBottomColor: 'rgba(255,255,255,0.2)' }}
                                        onPress={() => {
                                            setRole(item);
                                            setMenuOuvert(false);
                                        }}
                                    >
                                        <Text style={{ color: role === item ? couleur.doreClair : couleur.blanc, fontWeight: role === item ? 'bold' : 'normal' }}>
                                            {item.charAt(0).toUpperCase() + item.slice(1)}
                                            {/*charAt(0) prend le 1er caractere du mot
                                                toUpperCase() met en majuscule le caractere pris par chartArt
                                                +item.slice(1) concatene le restedu mot a la majuscule */}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        {renduChampCitoyen()}
                        {renduChampResponsable()}
                        {renduChampEtablissement()}
                        {affiche_erreur()}

                        <TouchableOpacity
                            style={{ 
                                backgroundColor:chargement? '#c39e8a9e':couleur.dore, 
                                borderRadius: 25, 
                                padding: 16, 
                                alignItems: 'center', marginTop: 6, 
                                marginBottom: 20 }}
                            disabled={chargement} //empeche de cliquer sur connecter plusieur fois pendant le chargement
                            onPress={Inscrire}
                        >
                            {renduBouton()}
                            </TouchableOpacity>

                        <TouchableOpacity onPress={seConnecter} style={{marginBottom:'30%'}}>
                            <Text style={{ color: couleur.blanc, textAlign: 'center', fontSize: 14,
                            fontWeight: 'bold'}} allowFontScaling={false}>
                            Se connecter?
                            </Text>
                        </TouchableOpacity>

                    </Animated.View>
                </ScrollView>
            </ImageBackground>
    );
}