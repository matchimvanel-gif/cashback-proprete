import React from 'react';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarStyle: { display: 'none' }, // cache la barre du bas
      headerShown: false                // cache le header
    }}>
      <Tabs.Screen name="citoyen" />
      <Tabs.Screen name="etablissement" />
      <Tabs.Screen name="hyzakam" />
      <Tabs.Screen name="responsable" />
    </Tabs>
  );
}