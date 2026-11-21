import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AuthHeader from '@/components/AuthHeader';
import AuthInput from '@/components/AuthInput';
import FormError from '@/components/FormError';
import SaveLoginDialog from '@/components/SaveLoginDialog';
import { MockAuth } from '@/mock/mockAuth';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { isValidEmail } from '@/lib/validation';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState<{ email: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSave, setAskSave] = useState(false);

  useEffect(() => {
    const s = MockAuth.getSavedLogin();
    if (s) {
      setSaved(s);
      setEmail(s.email);
      setPassword(s.password);
      return;
    }
    if (typeof emailParam === 'string' && emailParam.trim()) {
      setEmail(emailParam.trim());
    }
  }, [emailParam]);

  const usingSaved = !!saved && saved.email === email.trim() && saved.password === password;

  const goNext = () => router.replace('/choose-profile');

  const onLogin = async () => {
    setError(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setError('Please enter a valid email address.');
    if (!password) return setError('Please enter your password.');

    setLoading(true);
    const res = await MockAuth.login(e, password);
    setLoading(false);
    if (!res.success) return setError(res.message);

    if (usingSaved) goNext();
    else setAskSave(true);
  };

  const onAnswerSave = (save: boolean) => {
    setAskSave(false);
    if (save) MockAuth.saveLogin(email, password);
    goNext();
  };

  const forgetSaved = () => {
    MockAuth.forgetLogin();
    setSaved(null);
    setEmail('');
    setPassword('');
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
          <Text style={[styles.title, { color: colors.text }]}>Welcome back!</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Log in to keep your family&apos;s medicines organized and synced across devices.
          </Text>

          {usingSaved ? (
            <View style={[styles.savedNote, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="key-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.savedText, { color: colors.textMuted }]}>
                Using your saved login info.
              </Text>
              <Pressable onPress={forgetSaved} hitSlop={8}>
                <Text style={[styles.savedLink, { color: colors.text }]}>Forget</Text>
              </Pressable>
            </View>
          ) : null}

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
            placeholder="Enter your password"
            password
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onLogin}
          />

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && styles.disabled]}
            onPress={onLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAction} />
            ) : (
              <Text style={[styles.primaryText, { color: colors.onAction }]}>Log In</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/forgot-password',
                params: email.trim() ? { email: email.trim() } : undefined,
              })
            }
            hitSlop={8}
            disabled={loading}
            style={styles.forgotWrap}
          >
            <Text style={[styles.forgotLink, { color: colors.text }]}>Forgot password?</Text>
          </Pressable>

          <Text style={[styles.hint, { color: colors.textMuted }]}>Don&apos;t have an account?</Text>
          <Pressable
            style={[
              styles.outlineBtn,
              { borderColor: colors.primary, backgroundColor: colors.surface },
            ]}
            onPress={() => router.replace('/signup')}
            disabled={loading}
          >
            <Text style={[styles.outlineText, { color: colors.text }]}>Sign in</Text>
          </Pressable>
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
  savedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 4,
    marginBottom: Spacing.md - 2,
  },
  savedText: { flex: 1, fontSize: 13 },
  savedLink: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.7 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  forgotWrap: { alignSelf: 'flex-end', marginTop: Spacing.sm },
  forgotLink: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  hint: { textAlign: 'center', fontSize: 14, marginVertical: Spacing.md - 2 },
  outlineBtn: {
    height: 50,
    borderRadius: Radius.sm + 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontSize: 16, fontWeight: '700' },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});