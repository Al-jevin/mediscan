import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthHeader from '@/components/AuthHeader';
import AuthInput from '@/components/AuthInput';
import FormError from '@/components/FormError';
import { MockAuth } from '@/mock/mockAuth';
import { isValidEmail, MIN_PASSWORD } from '@/lib/validation';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

type Step = 'request' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof emailParam === 'string' && emailParam.trim()) {
      setEmail(emailParam.trim());
    }
  }, [emailParam]);

  const onRequestCode = async () => {
    setError(null);
    setInfo(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setError('Please enter a valid email address.');

    setLoading(true);
    const res = await MockAuth.forgotPassword(e);
    setLoading(false);
    if (!res.success) return setError(res.message);

    setInfo(res.message);
    setStep('reset');
  };

  const onResetPassword = async () => {
    setError(null);
    setInfo(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setError('Please enter a valid email address.');
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from your email.');
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    const res = await MockAuth.resetPassword(e, code.trim(), password);
    setLoading(false);
    if (!res.success) return setError(res.message);

    router.replace({ pathname: '/login', params: { email: e } });
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
          <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {step === 'request'
              ? 'Enter your account email and we will send a 6-digit reset code.'
              : 'Enter the code from your email and choose a new password.'}
          </Text>

          <FormError message={error} />
          {info ? <Text style={[styles.info, { color: colors.success }]}>{info}</Text> : null}

          <AuthInput
            label="Email"
            placeholder="e.g. juan@email.com"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={step === 'request'}
          />

          {step === 'reset' ? (
            <>
              <AuthInput
                label="Reset code"
                placeholder="6-digit code"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              />
              <AuthInput
                label="New password"
                placeholder={`At least ${MIN_PASSWORD} characters`}
                password
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
              <AuthInput
                label="Confirm new password"
                placeholder="Re-enter your password"
                password
                autoComplete="new-password"
                value={confirm}
                onChangeText={setConfirm}
                onSubmitEditing={onResetPassword}
              />
            </>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && styles.disabled]}
            onPress={step === 'request' ? onRequestCode : onResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAction} />
            ) : (
              <Text style={[styles.primaryText, { color: colors.onAction }]}>
                {step === 'request' ? 'Send reset code' : 'Update password'}
              </Text>
            )}
          </Pressable>

          {step === 'reset' ? (
            <Pressable onPress={onRequestCode} hitSlop={8} disabled={loading} style={styles.secondaryLink}>
              <Text style={[styles.link, { color: colors.text }]}>Resend code</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() =>
              router.replace({
                pathname: '/login',
                params: email.trim() ? { email: email.trim() } : undefined,
              })
            }
            hitSlop={8}
            disabled={loading}
            style={styles.secondaryLink}
          >
            <Text style={[styles.link, { color: colors.text }]}>Back to Log In</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />
        <Text
          style={[
            styles.terms,
            { color: colors.textMuted, paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          For security, reset codes expire quickly and old sessions are signed out after a successful reset.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg - 4, paddingTop: Spacing.lg },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  info: { fontSize: 14, marginBottom: Spacing.sm + 2 },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.7 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondaryLink: { alignSelf: 'center', marginTop: Spacing.md },
  link: { fontSize: 14, fontWeight: '800' },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});