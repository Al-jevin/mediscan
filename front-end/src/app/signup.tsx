import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthHeader from '@/components/AuthHeader';
import AuthInput from '@/components/AuthInput';
import FormError from '@/components/FormError';
import SaveLoginDialog from '@/components/SaveLoginDialog';
import { MockAuth } from '@/mock/mockAuth';
import { isValidEmail, MIN_PASSWORD } from '@/lib/validation';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import TermsConsentModal from '../components/TermsConsentModal';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSave, setAskSave] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const onSignUp = async () => {
    setError(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setError('Please enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    const res = await MockAuth.signUp(e, password);

    if (res.code === 409) {
      const login = await MockAuth.login(e, password);
      setLoading(false);
      if (!login.success) {
        return setError('An account with this email already exists, but the password is incorrect. Try Log In instead.');
      }
      setAskSave(true);
      return;
    }

    setLoading(false);
    if (!res.success) return setError(res.message);

    router.push({ pathname: '/verify-code', params: { email: e } });
  };

  const onAnswerSave = (save: boolean) => {
    setAskSave(false);
    if (save) MockAuth.saveLogin(email, password);
    router.replace('/choose-profile');
  };

  const handleSignUpClick = () => {
    if (!email.trim() || !password.trim() || !confirm.trim()) {
      Alert.alert('Required Fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    setShowConsentModal(true);
  };

  const handleAcceptTerms = async () => {
    setShowConsentModal(false);
    onSignUp();
  };

  const handleRejectTerms = () => {
    setShowConsentModal(false);
    Alert.alert(
      'Terms Required',
      'You must accept the Philippine-Compliant Terms of Service and Medical Disclaimer to create a MediScan account.',
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <AuthHeader />

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Sign up to start keeping your family&apos;s medicines organized.
          </Text>

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

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && styles.disabled]}
            onPress={handleSignUpClick}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAction} />
            ) : (
              <Text style={[styles.primaryText, { color: colors.onAction }]}>Sign Up</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Already have an account?  </Text>
            <Pressable onPress={() => router.replace('/login')} hitSlop={8} disabled={loading}>
              <Text style={[styles.link, { color: colors.text }]}>Log In</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1 }} />
        <Text
          style={[
            styles.terms,
            { color: colors.textMuted, paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>

      <SaveLoginDialog visible={askSave} onAnswer={onAnswerSave} />
      <TermsConsentModal
        visible={showConsentModal}
        onAccept={handleAcceptTerms}
        onReject={handleRejectTerms}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg - 4, paddingTop: Spacing.lg },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: Spacing.sm, marginBottom: Spacing.md },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.7 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  hint: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: '800' },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});