import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSubscriptionStore } from '../src/stores/subscription-store';

export default function SettingsScreen() {
  const { devMode, setDevMode, tier } = useSubscriptionStore();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Subscription</Text>
              <Text style={styles.rowValue}>{tier === 'pro' ? 'Pro' : 'Free'}</Text>
            </View>
          </View>
        </View>

        {/* Developer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLabelGroup}>
                <Text style={styles.rowLabel}>Dev Mode</Text>
                <Text style={styles.rowDescription}>
                  Unlocks all Pro features for testing
                </Text>
              </View>
              <Switch
                value={devMode}
                onValueChange={setDevMode}
                trackColor={{ false: '#334155', true: '#6366F1' }}
                thumbColor={devMode ? '#FFFFFF' : '#94A3B8'}
              />
            </View>
            {devMode && (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerText}>
                  Pro features unlocked for testing
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>0.1.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Build</Text>
              <Text style={styles.rowValue}>Dev Client</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowLabelGroup: {
    flex: 1,
    marginRight: 16,
  },
  rowLabel: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  rowDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 16,
    color: '#94A3B8',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },

  // Dev banner
  devBanner: {
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  devBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
