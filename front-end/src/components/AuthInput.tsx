import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

type Props = TextInputProps & {
  label: string;
  password?: boolean;
  required?: boolean;
  invalid?: boolean;
};

export default function AuthInput({ label, password, required, invalid, ...rest }: Props) {
  const { colors } = useDisplayTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {label}
        {required ? <Text style={{ color: colors.statusDanger }}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor: colors.borderDefault,
            backgroundColor: colors.surfacePrimary,
          },
          invalid && { borderColor: colors.statusDanger, borderWidth: 1.5 },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={password ? hidden : false}
          autoCapitalize="none"
          {...rest}
        />
        {password ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel="Show or hide password">
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: Spacing.md - 2 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  box: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    paddingHorizontal: Spacing.md - 2, borderRadius: Radius.md - 2,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
