import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

// Para ito sa mga screens na wala pang laman, para may placeholder habang hindi pa tapos yung feature.
export default function ScreenPlaceholder({ name }: { name: string }) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={styles.c}>
      <Text style={styles.t}>{name} screen - work in progress</Text>
    </View>
  );
}
function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  t: { color: colors.textMuted },
});
}
