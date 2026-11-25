import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getLifetimeSavings,
  getRideTripHistory,
  LifetimeSavingsData,
  RideTripRecord,
} from '../../utils/liveSessionBridge';
import {
  getMonetizationConfig,
  openPartnerOffer,
  refreshMonetizationConfig,
  RemoteMonetizationConfig,
} from '../../utils/monetizationEngine';

export default function SpendLensScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [savings, setSavings] = useState<LifetimeSavingsData>({
    totalSaved: 0,
    tripCount: 0,
    lastTripSaved: 0,
  });
  const [trips, setTrips] = useState<RideTripRecord[]>([]);
  const [monetization, setMonetization] = useState<RemoteMonetizationConfig>(
    getMonetizationConfig()
  );

  const loadData = useCallback(async () => {
    const [s, t] = await Promise.all([
      getLifetimeSavings(),
      getRideTripHistory(),
    ]);
    setSavings(s);
    setTrips(t);
  }, []);

  useEffect(() => {
    loadData();
    refreshMonetizationConfig().then(setMonetization).catch(() => {});
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalSpent = trips.reduce((sum, t) => sum + (t.pricePaid || 0), 0);
  const totalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const avgPerKm = totalKm > 0 ? Math.round((totalSpent / totalKm) * 10) / 10 : 0;
  const extraFivePctCashback = Math.max(
    150,
    Math.round((totalSpent > 0 ? totalSpent : 3000) * 0.05)
  );

  // Spend by provider
  const byProvider: Record<string, { spent: number; count: number }> = {};
  for (const t of trips) {
    const cur = byProvider[t.providerName] || { spent: 0, count: 0 };
    cur.spent += t.pricePaid;
    cur.count += 1;
    byProvider[t.providerName] = cur;
  }
  const providerList = Object.entries(byProvider).sort(
    (a, b) => b[1].spent - a[1].spent
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Spend Lens</Text>
        <Text style={styles.screenSubtitle}>
          Track your ride expenses, savings & provider split
        </Text>

        {/* Hero Summary Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statLabelPrimary}>Total Saved</Text>
            <Text style={styles.statValuePrimary}>
              ₹{savings.totalSaved.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statSubPrimary}>
              Across {savings.tripCount} rides
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue}>
              ₹{Math.round(totalSpent).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statSub}>
              {avgPerKm > 0 ? `Avg ₹${avgPerKm}/km` : 'Book a ride to track'}
            </Text>
          </View>
        </View>

        {/* Commuter Cashback & UPI Monetization Card */}
        {monetization.enabled && (
          <View style={styles.cashbackPerkCard}>
            <View style={styles.cashbackBadgeRow}>
              <Text style={styles.cashbackBadge}>
                💳 COMMUTER PERK · EXTRA 5% BACK
              </Text>
              <Text style={styles.cashbackEstValue}>
                +₹{extraFivePctCashback} back
              </Text>
            </View>
            <Text style={styles.cashbackTitle}>
              {monetization.cashbackCardTitle}
            </Text>
            <Text style={styles.cashbackSub}>
              {monetization.cashbackCardSubtitle}
            </Text>
            <TouchableOpacity
              style={styles.cashbackCtaBtn}
              onPress={() =>
                openPartnerOffer(
                  'spend_lens_cashback_card',
                  monetization.cashbackCardTitle,
                  monetization.cashbackOfferUrl
                )
              }
              activeOpacity={0.85}
            >
              <Text style={styles.cashbackCtaText}>
                {monetization.cashbackCardCta}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Provider Breakdown */}
        {providerList.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Spend by Ride App</Text>
            {providerList.map(([provider, info]) => {
              const pct =
                totalSpent > 0
                  ? Math.max(8, Math.round((info.spent / totalSpent) * 100))
                  : 100;
              return (
                <View key={provider} style={styles.providerBarRow}>
                  <View style={styles.providerBarHeader}>
                    <Text style={styles.providerBarName}>
                      {provider} ({info.count}{' '}
                      {info.count === 1 ? 'ride' : 'rides'})
                    </Text>
                    <Text style={styles.providerBarAmount}>
                      ₹{Math.round(info.spent)}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Ride Ledger */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Ride History</Text>
          {trips.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyTitle}>No rides recorded yet</Text>
              <Text style={styles.emptySub}>
                Compare and book your next ride to track your commute spend and savings automatically.
              </Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => router.push('/location')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaButtonText}>Compare rides →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            trips.map((trip) => (
              <View key={trip.id} style={styles.tripRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.tripProvider}>
                    {trip.providerName} · {trip.productName}
                  </Text>
                  <Text style={styles.tripRoute} numberOfLines={1}>
                    {trip.pickup.split(',')[0]} →{' '}
                    {trip.destination.split(',')[0]} ({trip.distanceKm} km)
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.tripPrice}>₹{trip.pricePaid}</Text>
                  {trip.amountSaved > 0 && (
                    <Text style={styles.tripSaved}>
                      Saved ₹{trip.amountSaved}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
        {/* Play Store Compliance & Privacy Disclosure */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Privacy & Disclosure</Text>
          <Text style={styles.emptySub}>
            FareSnap is an independent commuter comparison utility and is not affiliated with Uber, Ola, Rapido, Namma Yatri, InDrive, Meru, or Bharat Cab. Optional account sessions stay strictly on your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statCardPrimary: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  statLabelPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 6,
  },
  statValuePrimary: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 6,
  },
  statSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  statSubPrimary: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 4,
  },
  cashbackPerkCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  cashbackBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cashbackBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  cashbackEstValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
    backgroundColor: '#ffffff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  cashbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cashbackSub: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  cashbackCtaBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cashbackCtaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  providerBarRow: {
    marginBottom: 12,
  },
  providerBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  providerBarName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  providerBarAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyEmoji: {
    fontSize: 38,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  ctaButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tripProvider: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tripRoute: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  tripPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  tripSaved: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
    marginTop: 2,
  },
});
