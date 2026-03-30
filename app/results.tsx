import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type RideOption = {
  id: string;
  provider: string;
  price: number;
  duration: number;
  rideType: string;
  specialty: string[];
  starRating: number;
};

const DATA: RideOption[] = [
  { id: 'rapido', provider: 'Rapido', price: 180, duration: 10, rideType: 'Bike/Auto', specialty: ['Cheapest'], starRating: 4.1 },
  { id: 'bharat', provider: 'Bharat Cab', price: 190, duration: 62, rideType: 'Cab', specialty: ['Budget', 'Government backed'], starRating: 3.8 },
  { id: 'namma', provider: 'Namma Yatri', price: 195, duration: 14, rideType: 'Auto', specialty: ['No Surge', 'South India'], starRating: 4.5 },
  { id: 'indrive', provider: 'inDrive', price: 210, duration: 12, rideType: 'Cab', specialty: ['Negotiate'], starRating: 4.2 },
  { id: 'ola', provider: 'Ola', price: 225, duration: 13, rideType: 'Cab', specialty: ['Wide coverage'], starRating: 4.3 },
  { id: 'uber', provider: 'Uber', price: 240, duration: 12, rideType: 'Cab', specialty: ['Standard pricing', 'Surge possible'], starRating: 4.4 },
  { id: 'meru', provider: 'Meru Cabs', price: 260, duration: 11, rideType: 'Cab', specialty: ['Premium', 'Reliable'], starRating: 4.0 },
  { id: 'blusmart', provider: 'BluSmart', price: 270, duration: 18, rideType: 'Electric', specialty: ['Eco', 'No Surge'], starRating: 4.6 },
  { id: 'savaari', provider: 'Savaari', price: 300, duration: 60, rideType: 'Cab', specialty: ['Outstation'], starRating: 3.9 },
];

const getAppUrl = (provider: string) => {
  switch (provider) {
    case 'Rapido':
      return 'https://play.google.com/store/apps/details?id=com.rapido.passenger';
    case 'Uber':
      return 'https://play.google.com/store/apps/details?id=com.ubercab';
    case 'Ola':
      return 'https://play.google.com/store/apps/details?id=com.olacabs.customer';
    case 'inDrive':
      return 'https://play.google.com/store/apps/details?id=sinet.startup.inDriver';
    case 'Namma Yatri':
      return 'https://play.google.com/store/apps/details?id=net.openkochi.yatri';
    case 'BluSmart':
      return 'https://play.google.com/store/apps/details?id=com.blusmart';
    case 'Meru Cabs':
      return 'https://play.google.com/store/apps/details?id=com.meru.meru';
    case 'Bharat Cab':
      return 'https://play.google.com/store/apps/details?id=com.bharatcab.customer';
    case 'Savaari':
      return 'https://play.google.com/store/apps/details?id=com.savaari';
    default:
      return `https://play.google.com/store/search?q=${encodeURIComponent(provider)}`;
  }
};

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pickup = String(params.pickup ?? 'Unknown');
  const destination = String(params.destination ?? 'Unknown');

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'cheapest' | 'fastest' | 'rated'>('all');

  const getFilteredRides = () => {
    switch (selectedFilter) {
      case 'cheapest':
        return [...DATA].sort((a, b) => a.price - b.price);
      case 'fastest':
        return [...DATA].sort((a, b) => a.duration - b.duration);
      case 'rated':
        return [...DATA].sort((a, b) => b.starRating - a.starRating);
      case 'all':
      default:
        return [...DATA].sort((a, b) => a.price - b.price);
    }
  };

  const filteredRides = getFilteredRides();
  const bestDeal = [...DATA].sort((a, b) => a.price - b.price)[0]?.id;

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'Eco': return '#16a34a';
      case 'Negotiate': return '#2563eb';
      case 'No Surge': return '#ea580c';
      default: return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride Options</Text>
        <Text style={styles.subtitle}>{pickup} → {destination}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterBar, {height: 52, flexGrow: 0}]} contentContainerStyle={{ alignItems: 'center' }}>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'cheapest' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('cheapest')}
        >
          <Text style={[styles.filterText, selectedFilter === 'cheapest' && styles.filterTextActive]}>💰 Cheapest</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'fastest' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('fastest')}
        >
          <Text style={[styles.filterText, selectedFilter === 'fastest' && styles.filterTextActive]}>⚡ Fastest</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'rated' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('rated')}
        >
          <Text style={[styles.filterText, selectedFilter === 'rated' && styles.filterTextActive]}>⭐ Highest Rated</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.list}>
        {filteredRides.map((item) => {
          const isBest = item.id === bestDeal;
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.provider}>{item.provider}</Text>
                  {isBest && <Text style={styles.bestBadge}>Best Deal</Text>}
                </View>

                <Text style={styles.details}>
                  {item.rideType} • ₹{item.price} • {item.duration} min • {item.starRating}★
                </Text>

                <View style={styles.badges}>
                  {item.specialty.map((badge, index) => (
                    <Text key={index} style={[styles.badge, { backgroundColor: getBadgeColor(badge) }]}>
                      {badge}
                    </Text>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.bookButton} onPress={() => Linking.openURL(getAppUrl(item.provider))}>
                <Text style={styles.bookText}>Book</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#374151',
    height: 36,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#1b273c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  provider: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginRight: 8,
  },
  bestBadge: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  details: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  bookText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    margin: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
});