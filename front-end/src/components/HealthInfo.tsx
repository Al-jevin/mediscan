import React, { useEffect, useState } from 'react';
import {
  Keyboard, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import {
  EMERGENCY_CONTACT_NAME_MAX_LENGTH,
  EMERGENCY_CONTACT_NUMBER_MAX_LENGTH,
  sanitizeEmergencyContactName,
  sanitizeEmergencyContactNumber,
} from '@/utils/healthInfoInput';

interface HealthInfoData {
  allergies: string;
  conditions: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
}

const EMPTY: HealthInfoData = {
  allergies: '',
  conditions: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
};

const HEALTH_KEY = 'mediscan:healthInfo';

async function loadHealthInfo(): Promise<HealthInfoData> {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_KEY);
    const saved = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
    return {
      ...saved,
      emergencyContactName: sanitizeEmergencyContactName(
        typeof saved.emergencyContactName === 'string' ? saved.emergencyContactName : '',
      ),
      emergencyContactNumber: sanitizeEmergencyContactNumber(
        typeof saved.emergencyContactNumber === 'string' ? saved.emergencyContactNumber : '',
      ),
    };
  } catch (e) {
    console.warn('loadHealthInfo failed', e);
    return EMPTY;
  }
}

async function saveHealthInfo(info: HealthInfoData): Promise<boolean> {
  try {
    await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(info));
    return true;
  } catch (e) {
    console.warn('saveHealthInfo failed', e);
    return false;
  }
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  maxLength: number;
}) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

export default function HealthInfo({
  visible, onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<HealthInfoData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    loadHealthInfo().then((saved) => {
      if (active) setForm(saved);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const set = (key: keyof HealthInfoData) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveHealthInfo(form);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              marginBottom: kbHeight,
              paddingBottom: kbHeight > 0 ? Spacing.md : insets.bottom + Spacing.md,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Health Information</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View>
            <Field
              label="Allergies"
              value={form.allergies}
              onChangeText={set('allergies')}
              placeholder="e.g. Peanuts, Penicillin"
              maxLength={150}
            />
            <Field
              label="Conditions"
              value={form.conditions}
              onChangeText={set('conditions')}
              placeholder="e.g. Diabetes, Asthma"
              maxLength={150}
            />
            <Field
              label="Emergency Contact Name"
              value={form.emergencyContactName}
              onChangeText={(value) => set('emergencyContactName')(sanitizeEmergencyContactName(value))}
              placeholder="Name of contact"
              maxLength={EMERGENCY_CONTACT_NAME_MAX_LENGTH}
            />
            <Field
              label="Emergency Contact Number"
              value={form.emergencyContactNumber}
              onChangeText={(value) => set('emergencyContactNumber')(sanitizeEmergencyContactNumber(value))}
              placeholder="Contact number"
              keyboardType="phone-pad"
              maxLength={EMERGENCY_CONTACT_NUMBER_MAX_LENGTH}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.8 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,31,32,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: { ...Type.h3, color: colors.text },
  field: { marginBottom: Spacing.md },
  label: { ...Type.label, color: colors.text, marginBottom: 6 },
  input: {
    height: 46, paddingHorizontal: Spacing.md, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    color: colors.text, fontSize: 14,
  },
  saveBtn: {
    height: 48, borderRadius: Radius.sm, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm,
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
}