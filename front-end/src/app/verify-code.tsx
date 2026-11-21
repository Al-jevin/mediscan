import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthHeader from '@/components/AuthHeader';
import FormError from '@/components/FormError';
import SaveLoginDialog from '@/components/SaveLoginDialog';
import { MockAuth } from '@/mock/mockAuth';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyCodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [askSave, setAskSave] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onVerify = async () => {
    setError(null);
    setInfo(null);
    if (code.length !== CODE_LENGTH) return setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);

    setLoading(true);
    const res = await MockAuth.verifyCode(email, code);
    setLoading(false);
    if (!res.success) {
      setCode('');
      return setError(res.message);
    }
    if ((res.data as { needsLogin?: boolean } | undefined)?.needsLogin || !MockAuth.isLoggedIn()) {
      setInfo(res.message || 'Email verified. Please log in.');
      router.replace({ pathname: '/login', params: { email } });
      return;
    }
    setAskSave(true);
  };

  const onAnswerSave = (save: boolean) => {
    setAskSave(false);
    if (save) MockAuth.saveCurrentLogin();
    router.replace('/choose-profile');
  };

  const onResend = async () => {
    setError(null);
    const res = await MockAuth.resendCode(email);
    if (res.success) {
      setInfo(res.message);
      setSeconds(RESEND_SECONDS);
    } else setError(res.message);
  };

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <AuthHeader />

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            We sent a 6-digit code to <Text style={[styles.email, { color: colors.text }]}>{email || 'your email'}</Text>. Enter it below to verify your account.
          </Text>

          <FormError message={error} />
          {info ? <Text style={[styles.info, { color: colors.success }]}>{info}</Text> : null}

          <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const active = i === Math.min(code.length, CODE_LENGTH - 1);
              return (
                <View
                  key={i}
                  style={[
                    styles.box,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    active && { borderWidth: 2, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.digit, { color: colors.text }]}>{code[i] ?? ''}</Text>
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              autoFocus
              style={styles.hiddenInput}
              onSubmitEditing={onVerify}
              accessibilityLabel="Verification code"
            />
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && styles.disabled]}
            onPress={onVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAction} />
            ) : (
              <Text style={[styles.primaryText, { color: colors.onAction }]}>Verify</Text>
            )}
          </Pressable>

          <View style={styles.row}>
            {seconds > 0 ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Didn&apos;t get the code? Resend in {mm}:{ss}
              </Text>
            ) : (
              <Pressable onPress={onResend} hitSlop={8}>
                <Text style={[styles.link, { color: colors.text }]}>Resend code</Text>
              </Pressable>
            )}
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/signup'))} hitSlop={8}>
              <Text style={[styles.link, { color: colors.text }]}>Change email</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg - 4, paddingTop: Spacing.lg },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: Spacing.sm, marginBottom: Spacing.md },
  email: { fontWeight: '700' },
  info: { fontSize: 14, marginBottom: Spacing.sm + 2 },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md + 4 },
  box: {
    width: 46,
    height: 54,
    borderRadius: Radius.sm + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0.01 },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.7 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  hint: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '800' },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});