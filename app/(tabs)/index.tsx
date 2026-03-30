import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');

  const onCompare = () => {
    if (!pickup || !destination) return;
    router.push({
      pathname: '/results',
      params: { pickup, destination },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.emoji}>🚗</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>FareSnap</Text>
          <Text style={styles.subtitle}>Compare all ride apps instantly</Text>
        </View>

        <Text style={styles.sectionTitle}>Where are you going?</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Pickup location</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter pickup address"
            placeholderTextColor="#64748b"
            value={pickup}
            onChangeText={setPickup}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter destination"
            placeholderTextColor="#64748b"
            value={destination}
            onChangeText={setDestination}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (!pickup || !destination) && styles.buttonDisabled]}
          onPress={onCompare}
          disabled={!pickup || !destination}
        >
          <Text style={styles.buttonText}>Compare Rides</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Tap compare to view live ride options with price estimates.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  emoji: {
    fontSize: 64,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: '#f8fafc',
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    backgroundColor: '#374151',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
  },
});
