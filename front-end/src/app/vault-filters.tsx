import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarDatePicker from '@/components/medicine/CalendarDatePicker';
import { Components, Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { getListQuery, isListScope, setListQuery } from '@/services/listQueryStore';
import type { MedicineForm, UrgencyFilter } from '@/types/medicine';
import { MEDICINE_FORMS, mdyToYMD, ymdToMDY } from '@/utils/medicine';

export default function VaultFiltersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const { scope: scopeParam } = useLocalSearchParams<{ scope?: string }>();
  const scope = isListScope(scopeParam) ? scopeParam : 'vault';
  const current = getListQuery(scope);

  const urgencyOptions: {
    key: Exclude<UrgencyFilter, 'none'>;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] = [
    { key: 'within7', label: 'Expiring within 7 days', icon: 'time-outline', color: colors.statusWarning },
    { key: 'within30', label: 'Expiring within 30 days', icon: 'time-outline', color: colors.statusWarning },
    { key: 'expired', label: 'Expired', icon: 'close', color: colors.statusDanger },
    { key: 'custom', label: 'Custom range', icon: 'calendar-outline', color: colors.textPrimary },
  ];

  const [forms, setForms] = useState<MedicineForm[]>(current.forms);
  const [urgency, setUrgency] = useState<UrgencyFilter>(current.urgency);
  const [fromText, setFromText] = useState(ymdToMDY(current.customFrom));
  const [toText, setToText] = useState(ymdToMDY(current.customTo));
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);
  const [error, setError] = useState('');

  const toggleForm = (f: MedicineForm) =>
    setForms((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const toggleUrgency = (u: UrgencyFilter) => {
    setError('');
    setUrgency((prev) => (prev === u ? 'none' : u));
  };

  const reset = () => {
    setForms([]);
    setUrgency('none');
    setFromText('');
    setToText('');
    setError('');
  };

  const apply = () => {
    let customFrom: string | null = null;
    let customTo: string | null = null;
    if (urgency === 'custom') {
      customFrom = fromText.trim() ? mdyToYMD(fromText) : null;
      customTo = toText.trim() ? mdyToYMD(toText) : null;
      if ((fromText.trim() && !customFrom) || (toText.trim() && !customTo)) {
        setError('Please enter dates as MM/DD/YYYY.');
        return;
      }
      if (!customFrom || !customTo) {
        setError('Enter both a From and To date, or unselect Custom range.');
        return;
      }
      if (customFrom && customTo && customFrom > customTo) {
        setError('The From date must be before the To date.');
        return;
      }
    }
    setListQuery(scope, { forms, urgency, customFrom, customTo });
    router.back();
  };

  const customOn = urgency === 'custom';

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close filters" />

      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={[styles.titleRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Filters</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.sm }}>
          <View style={styles.sectionHead}>
            <Text style={[styles.section, { color: colors.textPrimary }]}>Medicine Form</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Multi-select</Text>
          </View>
          <View style={styles.wrap}>
            {MEDICINE_FORMS.map((f) => {
              const on = forms.includes(f);
              return (
                <Pressable
                  key={f}
                  onPress={() => toggleForm(f)}
                  style={[
                    styles.pill,
                    { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                    on && { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  {on && <Ionicons name="checkmark" size={16} color={colors.onAction} />}
                  <Text
                    style={[
                      styles.pillText,
                      { color: on ? colors.onAction : colors.textPrimary },
                    ]}
                  >
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.section, { color: colors.textPrimary, marginBottom: Spacing.sm + 4 }]}>
            Date Range / Urgency
          </Text>
          <View style={styles.wrap}>
            {urgencyOptions.map((u) => {
              const on = urgency === u.key;
              return (
                <Pressable
                  key={u.key}
                  onPress={() => toggleUrgency(u.key)}
                  style={[
                    styles.pill,
                    { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                    on && { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={u.icon} size={16} color={on ? colors.onAction : u.color} />
                  <Text
                    style={[
                      styles.pillText,
                      { color: on ? colors.onAction : colors.textPrimary },
                    ]}
                  >
                    {u.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dates}>
            <DateField
              label="From"
              value={fromText}
              onChange={(value) => {
                setFromText(value);
                setError('');
              }}
              enabled={customOn}
              onOpenPicker={() => setDatePickerTarget('from')}
            />
            <DateField
              label="To"
              value={toText}
              onChange={(value) => {
                setToText(value);
                setError('');
              }}
              enabled={customOn}
              onOpenPicker={() => setDatePickerTarget('to')}
            />
          </View>
          {error ? <Text style={[styles.error, { color: colors.statusDanger }]}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.buttons}>
          <Pressable
            style={[
              Components.buttonSecondary,
              styles.resetBtn,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
            onPress={reset}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
              Reset
            </Text>
          </Pressable>
          <Pressable
            style={[
              Components.buttonPrimary,
              { flex: 1, backgroundColor: colors.actionPrimary },
            ]}
            onPress={apply}
            accessibilityRole="button"
          >
            <Text style={[Components.buttonPrimaryText, { color: colors.onAction }]}>
              Apply Filters
            </Text>
          </Pressable>
        </View>
      </View>

      <CalendarDatePicker
        visible={datePickerTarget !== null}
        value={
          datePickerTarget === 'from'
            ? mdyToYMD(fromText)
            : datePickerTarget === 'to'
              ? mdyToYMD(toText)
              : null
        }
        title={datePickerTarget === 'from' ? 'From Date' : 'To Date'}
        onSelect={(date) => {
          if (datePickerTarget === 'from') setFromText(ymdToMDY(date));
          if (datePickerTarget === 'to') setToText(ymdToMDY(date));
          setError('');
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}

function DateField({
  label,
  value,
  onChange,
  enabled,
  onOpenPicker,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  enabled: boolean;
  onOpenPicker: () => void;
}) {
  const { colors } = useDisplayTheme();
  const onText = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    onChange(out);
  };
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.dateLabel, { color: colors.textSecondary }, !enabled && { opacity: 0.5 }]}>
        {label}
      </Text>
      <View
        pointerEvents={enabled ? 'auto' : 'none'}
        style={[
          styles.dateBox,
          { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
          !enabled && { opacity: 0.5 },
        ]}
      >
        <TextInput
          style={[styles.dateInput, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onText}
          editable={enabled}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={10}
          accessibilityLabel={`${label} date`}
          accessibilityState={{ disabled: !enabled }}
        />
        <Pressable
          onPress={onOpenPicker}
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityLabel={`Choose ${label.toLowerCase()} date`}
          accessibilityState={{ disabled: !enabled }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,31,32,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg - 4,
    paddingTop: Spacing.sm + 4,
    maxHeight: '90%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.md },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm + 4,
    borderBottomWidth: 1,
    marginBottom: Spacing.md,
  },
  title: { ...Type.h2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm + 4 },
  section: { ...Type.label },
  hint: { ...Type.caption },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md - 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pillText: { ...Type.caption, fontWeight: '600' },
  divider: { height: 1, marginVertical: Spacing.md },
  dates: { flexDirection: 'row', gap: Spacing.sm + 4, marginTop: Spacing.md },
  dateLabel: { ...Type.caption, marginBottom: Spacing.xs },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm + 4,
    minHeight: 48,
  },
  dateInput: { flex: 1, ...Type.body, paddingVertical: Spacing.sm },
  error: { ...Type.caption, marginTop: Spacing.sm },
  buttons: { flexDirection: 'row', gap: Spacing.sm + 4, marginTop: Spacing.md },
  resetBtn: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
});