import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AppHeader from '@/components/AppHeader';
import Popup from '@/components/medicine/Popup';
import { Components, Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { getNoteDraft, setNoteDraft } from '@/services/noteDraft';
import { getMedicineById, updateNote } from '@/services/vaultStore';
import { medicineName } from '@/utils/medicine';

const MAX_LENGTH = 150;

export default function AddNoteScreen() {
  const params = useLocalSearchParams<{ id?: string; draft?: string; name?: string }>();
  const router = useRouter();
  const { colors } = useDisplayTheme();
  const isDraft = params.draft === '1';
  const medicine = !isDraft && params.id ? getMedicineById(params.id) : undefined;

  const title = isDraft
    ? params.name ?? 'This medicine'
    : medicine ? `${medicineName(medicine)} ${medicine.fda_dosage_strength}` : 'Medicine';
  const startText = isDraft ? getNoteDraft() : medicine?.vault_note ?? '';

  const [text, setText] = useState(startText);
  const [saving, setSaving] = useState(false);
  const [savedPopup, setSavedPopup] = useState(false);
  const [focused, setFocused] = useState(false);

  const changed = text.trim() !== startText.trim();

  const save = async () => {
    if (saving) return;
    if (isDraft) {
      setNoteDraft(text.trim());
      router.back();
      return;
    }
    if (!params.id) return;
    setSaving(true);
    try {
      await updateNote(params.id, text);
      setSavedPopup(true);
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    setSavedPopup(false);
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surfacePrimary }]}>
      <AppHeader title="Add Note" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.banner, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>
              Adding a personal note for this medicine
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.textPrimary }]}>Your Note</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                borderColor: focused ? colors.statusWarning : colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="e.g. Take after meals, causes drowsiness..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
            autoFocus
            accessibilityLabel="Your note"
          />
          <Text style={[styles.counter, { color: colors.textSecondary }]}>
            {text.length}/{MAX_LENGTH}
          </Text>

          <Pressable
            style={({ pressed }) => [
              Components.buttonPrimary,
              { backgroundColor: colors.actionPrimary },
              (!changed || saving) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
            onPress={save}
            disabled={!changed || saving}
            accessibilityRole="button"
          >
            <Text style={[Components.buttonPrimaryText, { color: colors.onAction }]}>
              {saving ? 'Saving…' : 'Save Note'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Popup
        visible={savedPopup}
        icon="checkmark-circle"
        title={text.trim() ? 'Note Saved' : 'Note Removed'}
        message={
          text.trim()
            ? `Your note for ${title} was saved to your vault.`
            : `The note for ${title} was removed.`
        }
        onClose={done}
        actions={[{ label: 'Done', onPress: done }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.md + 4, gap: Spacing.sm },
  banner: { borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.md },
  bannerTitle: { ...Type.label },
  bannerSub: { ...Type.caption, marginTop: 2 },
  label: { ...Type.label },
  input: {
    ...Type.body,
    minHeight: 160,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    outlineWidth: 0,
  },
  counter: { ...Type.caption, alignSelf: 'flex-end', marginBottom: Spacing.sm },
});