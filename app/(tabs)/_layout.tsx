import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          height: 58,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Compare',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🚗</Text>,
        }}
      />
      <Tabs.Screen
        name="spend"
        options={{
          title: 'Spend Lens',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📊</Text>,
        }}
      />
    </Tabs>
  );
}
