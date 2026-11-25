import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Dynamically calculate bottom padding & tab height across all phone form factors
  // (iPhone notch/Dynamic Island, Android gesture navigation, Android 3-button navigation, and zero-inset devices)
  const bottomInset =
    insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 8 : 6;
  const tabContentHeight = 54;
  const totalTabHeight = tabContentHeight + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: totalTabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: Platform.OS === 'android' ? 2 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Compare',
          tabBarIcon: ({ focused }) => (
            <Text
              style={{
                fontSize: 20,
                transform: [{ scale: focused ? 1.08 : 1.0 }],
              }}
            >
              🚗
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="spend"
        options={{
          title: 'Spend Lens',
          tabBarIcon: ({ focused }) => (
            <Text
              style={{
                fontSize: 20,
                transform: [{ scale: focused ? 1.08 : 1.0 }],
              }}
            >
              📊
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
