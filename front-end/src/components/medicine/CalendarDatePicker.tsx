import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '@/constants/display';
import { parseDate, toYMD } from '@/utils/medicine';

type Props = {
  visible: boolean;
  value: string | null;
  title: string;
  onSelect: (date: string) => void;
  onClose: () => void;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarDatePicker({ visible, value, title, onSelect, onClose }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);
  const baseMonth = parseDate(value) ?? new Date();
  const month = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + monthOffset, 1);

  const close = () => {
    setMonthOffset(0);
    onClose();
  };

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = Array.from(
    { length: Math.ceil((offset + daysInMonth) / 7) * 7 },
    (_, index) => index < offset || index >= offset + daysInMonth ? null : index - offset + 1,
  );
  const weeks = Array.from(
    { length: Math.ceil(cells.length / 7) },
    (_, index) => cells.slice(index * 7, index * 7 + 7),
  );
  const selected = parseDate(value);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close date picker"
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.monthRow}>
            <Pressable
              style={styles.monthButton}
              onPress={() => setMonthOffset((offset) => offset - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable
              style={styles.monthButton}
              onPress={() => setMonthOffset((offset) => offset + 1)}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={styles.dayCell}>
                <Text style={styles.weekday}>{day}</Text>
              </View>
            ))}
          </View>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (day === null) return <View key={`empty-${dayIndex}`} style={styles.dayCell} />;
                const isSelected = selected?.getFullYear() === year
                  && selected.getMonth() === monthIndex
                  && selected.getDate() === day;
                return (
                  <Pressable
                    key={day}
                    style={[styles.dayCell, styles.dayButton, isSelected && styles.selectedDay]}
                    onPress={() => {
                      setMonthOffset(0);
                      onSelect(toYMD(new Date(year, monthIndex, day)));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${month.toLocaleDateString(undefined, { month: 'long' })} ${day}, ${year}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Pressable
            style={styles.closeButton}
            onPress={close}
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.sm + 4,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surfacePrimary,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { ...Type.h3, color: Colors.textPrimary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  monthLabel: { ...Type.label, color: Colors.textPrimary },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 38 },
  weekday: { ...Type.caption, color: Colors.textSecondary },
  dayButton: { borderRadius: Radius.pill },
  selectedDay: { backgroundColor: Colors.actionPrimary },
  dayText: { ...Type.body, color: Colors.textPrimary },
  selectedDayText: { color: Colors.onAction, fontWeight: '700' },
  closeButton: { alignSelf: 'flex-end', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  closeText: { ...Type.label, color: Colors.textPrimary },
});
