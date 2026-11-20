import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthHeader from '@/components/AuthHeader';
import AuthInput from '@/components/AuthInput';
import FormError from '@/components/FormError';
import TermsConsentModal from '@/components/TermsConsentModal';
import { TERMS_VERSION } from '@/components/TermsMedicalDisclaimerContent';
import { MockAuth } from '@/mock/mockAuth';
import { isValidEmail, MIN_PASSWORD } from '@/lib/validation';
import { Colors, Radius, Spacing } from '@/constants/display';

// Sign Up ("Sign in" button sa Log In screen).
//
// Flow:
//  1. User fills in email + password + confirm and accepts Terms.
//  2. Frontend POST /auth/register -> verification email.
//  3. Verify screen -> OTP -> auto-login (or redirect to Log In).
export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const onSignUp = async () => {
    setError(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setError('Please enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    const res = await MockAuth.signUp(e, password, {
      accepted: true,
      version: TERMS_VERSION,
    });
    setLoading(false);
    if (!res.success) return setError(res.message);

    // Always verify via email OTP (no login probe that burned rate limits).
    router.push({ pathname: '/verify-code', params: { email: e } });
  };

  const handleSignUpClick = () => {
    setError(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setError('Please enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');
    setShowConsentModal(true);
  };

  const handleAcceptTerms = () => {
    setShowConsentModal(false);
    void onSignUp();
  };

  const handleRejectTerms = () => {
    setShowConsentModal(false);
    Alert.alert(
      'Terms Required',
      'You must accept the Philippine-Compliant Terms of Service and Medical Disclaimer to create a MediScan account.',
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <AuthHeader />

        <View style={styles.body}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Sign up to start keeping your family&apos;s medicines organized.</Text>

          <FormError message={error} />

          <AuthInput
            label="Email"
            placeholder="e.g. juan@email.com"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <AuthInput
            label="Password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            password
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <AuthInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            password
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={handleSignUpClick}
          />

          <Pressable style={[styles.primaryBtn, loading && styles.disabled]} onPress={handleSignUpClick} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign Up</Text>}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.hint}>Already have an account?  </Text>
            <Pressable onPress={() => router.replace('/login')} hitSlop={8} disabled={loading}>
              <Text style={styles.link}>Log In</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1 }} />
        <Text style={[styles.terms, { paddingBottom: insets.bottom + Spacing.md }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>

      <TermsConsentModal
        visible={showConsentModal}
        onAccept={handleAcceptTerms}
        onReject={handleRejectTerms}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  body: { paddingHorizontal: Spacing.lg - 4, paddingTop: Spacing.lg },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textMuted, marginTop: Spacing.sm, marginBottom: Spacing.md },
  primaryBtn: {
    height: 50, borderRadius: Radius.sm + 2, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  disabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  hint: { color: Colors.textMuted, fontSize: 14 },
  link: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  terms: {
    textAlign: 'center', color: Colors.textMuted, fontSize: 12, lineHeight: 18,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
  },
});