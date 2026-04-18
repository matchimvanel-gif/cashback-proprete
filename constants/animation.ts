import { Animated, StyleSheet } from 'react-native'
import { useRef } from 'react'

export const couleur = {
    marine: '#294f78',
    bleuFoncer:'rgba(22, 58, 96, 0.85)',
    marineTransparent:'rgba(41,79,120,0.7)',
    dore: '#C9A84C',
    doreClair: '#F5D98B',
    turquoise: '#4ECDC4',
    blanc: '#FFFFFF',
    erreur: '#5e2923',
    erreurClair:'#9a432b',
    vert:'#2d6a4f',
grey:'rgba(71,65,65,0.55)'
}

export const stylesTitre= StyleSheet.create({
    titre : {
        color: couleur.doreClair,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 10
    },
    sousTitre :{
        color: couleur.dore, 
        fontWeight: 'bold', 
        marginBottom: 10
    }
})

export function utiliserAnimationEntree() {
    const animation = useRef(new Animated.Value(500)).current
    const progression = useRef(new Animated.Value(0)).current

    function demarrerEntree() {
        Animated.timing(animation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true
        }).start()
    }

    function demarrerProgression() {
        progression.setValue(0)
        Animated.loop(
            Animated.sequence([
                Animated.timing(progression, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: false
                }),
                Animated.timing(progression, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: false
                }),
            ])
        ).start()
    }

    function arreterProgression() {
        progression.stopAnimation()
        progression.setValue(0)
    }

    return {
        animation,
        progression,
        demarrerEntree,
        demarrerProgression,
        arreterProgression
    }
}