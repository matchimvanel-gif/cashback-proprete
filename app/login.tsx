import { useEffect, useState} from "react"
import {View,Text,TextInput,TouchableOpacity,ImageBackground,Animated} from 'react-native'
import { router} from 'expo-router'
import { signInWithEmailAndPassword, sendPasswordResetEmail} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebaseConfig'
import { couleur, utiliserAnimationEntree } from '../constants/animation'
import { ROLE_ROUTES, type Role } from '../constants/roles'


export default function ecranLogin(){
    const [email,setEmail]=useState('');
    const [password,setPassword]=useState('');
    const [erreur,setErreur]=useState('');
    const [chargement,setCharge]=useState(false);
    const [isFocus,setIsFocus]=useState(false); // email
    const [isFocused,setIsFocused]=useState(false);//password
    const { animation, progression, demarrerEntree, demarrerProgression, arreterProgression } = utiliserAnimationEntree()
    const [messageReset, setMessageReset] = useState('');

    async function reinitialiserMotDePasse() {
        if (email === '') {
            afficherErreurTemporaire('Donne ton email.')
            return
    }
        try {
            await sendPasswordResetEmail(auth, email) //connecte toi a firebase verifie si email dans base de donner et envois un mail a l'adresse email
            setMessageReset('Email envoyé ! Vérifie ta boîte mail.')
            setTimeout(() => setMessageReset(''), 5000)
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') afficherErreurTemporaire('Aucun compte avec cet email.')
            if (e.code === 'auth/invalid-email')  afficherErreurTemporaire('Email invalide.')
        }
    }

    async function seConnecter(){
        if (email === '' || password === '') {
                afficherErreurTemporaire('Remplis tous les champs.')
                return
        }
        setCharge(true)
        demarrerProgression()
        try { //try catch est l'equivalent de if else juste qu'on essaie try et si sa marche pas on vas dans catch
            const resultat = await signInWithEmailAndPassword(auth, email, password) //renvoie les informations de l'utilisateur dans resultat
            const uid = resultat.user.uid // recupere l'uid de l'utilisateur dans resultat
            const docSnap = await getDoc(doc(db, 'utilisateurs', uid))// utilise l'iud de l'utilisateur pour recuperer la fiche qui contient toute ses informations et actions mener dans l'application pour le stocker dans docSnap
            const role = docSnap.data()!.role as Role
            router.replace(ROLE_ROUTES[role])
        } catch (e: any) { // e contient le detail de l'erreur 
            if (e.code === 'auth/invalid-credential') afficherErreurTemporaire('Email ou mot de passe incorrect.')
            if (e.code === 'auth/too-many-requests')  afficherErreurTemporaire('Trop de tentatives. Réessaie plus tard.')
            if (e.code === 'auth/network-request-failed') afficherErreurTemporaire('Pas de connexion internet.')
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
    function allerInscription(){
        router.push('/inscription')
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
    },[]);
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
                    Se connecter
                </Text>
            )
        }
    }


    return (
            <ImageBackground
                source={require('../assets/images/papier-abstrait-coupe-conception-art-pour-modele-affiche-resume-modele_41204-8981.jpg')}
                resizeMode="cover"
                style={{ flex: 1,
                         height: '100%',
                         width:'100%',}}
            >
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
                        textAlign: 'center', marginBottom: 10 }}
                        allowFontScaling={false}>
                        {/* allowFontscaling sert a obliger le telephone a utiliser les polices et tailles disposer dans le code */}
                            Cashback de Propreté
                    </Text>

                    <Text style={{ 
                        color: couleur.turquoise, fontSize: 15, 
                        textAlign: 'center', marginBottom: 40, 
                        letterSpacing: 2 }} allowFontScaling={false}>
                            Connexion
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
                            backgroundColor:(isFocused||password!=='')? 'rgba(0,0,0,0.0)':'transparent',
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
                            secureTextEntry
                            autoCapitalize="none"
                            allowFontScaling={false}
                        />
                    </View>

                    {/* Message de confirmation */}
                    {messageReset !== '' && (
                        <Text style={{ color: couleur.turquoise, textAlign: 'center', marginBottom: 10 }}>
                            {messageReset}
                        </Text>
                    )}

                    {/* Lien mot de passe oublié */}
                    <TouchableOpacity 
                        style={{ marginBottom: 15 }}
                        onPress={reinitialiserMotDePasse}
                    >
                        <Text style={{ 
                            color: couleur.doreClair, 
                            textAlign: 'center', 
                            fontSize: 13 
                        }}>
                            Mot de passe oublié ?
                        </Text>
                    </TouchableOpacity>

                    {affiche_erreur()}

                    <TouchableOpacity
                        style={{ 
                            backgroundColor:chargement? '#c39e8a9e':couleur.dore, 
                            borderRadius: 25, 
                            padding: 16, 
                            alignItems: 'center', marginTop: 6, 
                            marginBottom: 20 }}
                        disabled={chargement} //empeche de cliquer sur connecter plusieur fois pendant le chargement
                        onPress={seConnecter}
                    >
                        {renduBouton()}
                        </TouchableOpacity>

                    <TouchableOpacity onPress={allerInscription}>
                        <Text style={{ color: couleur.blanc, textAlign: 'center', fontSize: 14,
                        fontWeight: 'bold'}} allowFontScaling={false}>
                        Pas de compte ? S'inscrire
                        </Text>
                    </TouchableOpacity>

                </Animated.View>
            </ImageBackground>
    );
}
