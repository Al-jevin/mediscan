import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { TermsLegalText } from '../components/TermsMedicalDisclaimerContent';

export default function TermsScreen() {
  const router = useRouter();
  const { colors } = useDisplayTheme();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>
          Terms &amp; Medical Disclaimer
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TermsLegalText />

        <TouchableOpacity
          style={[styles.homeBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Return to Home"
        >
          <Ionicons name="home-outline" size={18} color={colors.onAction} style={{ marginRight: 8 }} />
          <Text style={[styles.homeBtnText, { color: colors.onAction }]}>Return to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  topBarTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  homeBtn: {
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  homeBtnText: { fontSize: 15, fontWeight: '700' },
});