import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export const FormColors = {
  inputBorder: '#C9D6CF',
  placeholder: '#9AAFA3',
  helper: '#5B6B6C',
  required: '#D93025',
};

type FieldProps = {
  label: string;
  required?: boolean;
  helper?: string;
  children: ReactNode;
};

export function FormField({ label, required, helper, children }: FieldProps) {
  const { colors, isDark } = useDisplayTheme();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        {required && <Text style={styles.star}>*</Text>}
      </View>
      {children}
      {helper ? (
        <Text style={[styles.helper, { color: isDark ? colors.textSecondary : FormColors.helper }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

export function InputBox({ children }: { children: ReactNode }) {
  const { colors, isDark } = useDisplayTheme();
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
          borderColor: isDark ? colors.borderDefault : FormColors.inputBorder,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', gap: 3 },
  label: { fontSize: 14, fontWeight: '600' },
  star: { fontSize: 14, fontWeight: '700', color: FormColors.required },
  helper: { fontSize: 13 },
  box: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
