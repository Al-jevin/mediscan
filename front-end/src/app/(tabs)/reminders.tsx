import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReminderEditorModal from '@/components/ReminderEditorModal';
import type { Reminder } from '@/components/reminderTypes';
import { useColors } from '@/hooks/useColors';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useHeaderFilter } from '@/components/HeaderFilterContext';
import { useProfile } from '@/context/ProfileContext';
import { useVault } from '@/services/vaultStore';
import { createReminder, deleteReminder as deleteReminderRecord, fetchReminders, updateReminder } from '@/services/remindersApi';
import { cancelReminderNotification, scheduleReminderNotification } from '@/services/localNotifications';
import { overviewCounts } from '@/utils/medicine';

function withMembers(item: unknown): Reminder {
  const r = item as any;
  return {
    ...r,
    members: Array.isArray(r.members) ? r.members : r.member ? [r.member] : [],
  } as Reminder;
}

export default function RemindersScreen() {
  const colors = useColors();
  const { colors: displayColors, type, scaleFont } = useDisplayTheme();
  const insets = useSafeAreaInsets();
  const { profiles } = useProfile();
  const { medicines } = useVault();
  const params = useLocalSearchParams<{ openAdd?: string; member?: string; reminderId?: string; from?: string }>();
  const handledAddParam = useRef('');
  const returnHomeRef = useRef(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState('All Members');
  const [pendingMember, setPendingMember] = useState('All Members');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editorSession, setEditorSession] = useState(0);
  const [deletedItem, setDeletedItem] = useState<{ reminder: Reminder; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setOnFilterPress } = useHeaderFilter();

  useEffect(() => {
    setOnFilterPress(() => {
      setPendingMember(selectedMember);
      setFilterVisible(true);
    });
    return () => setOnFilterPress(null);
  }, [selectedMember, setOnFilterPress]);

  useEffect(() => {
    if (params.member) {
      queueMicrotask(() => {
        setSelectedMember(params.member!);
        setPendingMember(params.member!);
      });
    }
  }, [params.member]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setLoaded(false);
      fetchReminders(profiles)
        .then((saved) => {
          if (!isMounted) return;
          setReminders(saved.map(withMembers));
          setStorageError('');
        })
        .catch((error: unknown) => {
          if (!isMounted) return;
          setReminders([]);
          setStorageError(error instanceof Error ? error.message : 'Could not load reminders.');
        })
        .finally(() => {
          if (isMounted) setLoaded(true);
        });
      return () => {
        isMounted = false;
      };
    }, [profiles]),
  );

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  useEffect(() => {
    const addRequest = params.openAdd;
    if (addRequest && addRequest !== handledAddParam.current) {
      handledAddParam.current = addRequest;
      setEditingReminder(null);
      setEditorSession((session) => session + 1);
      setEditorVisible(true);
      router.setParams({ openAdd: undefined });
    }
  }, [params.openAdd]);

  const { member: requestedMember, reminderId: requestedReminderId, from: requestedFrom } = params;
  useEffect(() => {
    if (!loaded) return;
    if (!requestedMember && !requestedReminderId) return;
    if (requestedMember) {
      queueMicrotask(() => {
        setSelectedMember(requestedMember);
        setPendingMember(requestedMember);
        setShowAll(true);
      });
    }
    if (requestedReminderId) {
      const found = reminders.find((item) => item.id === requestedReminderId);
      if (found) {
        returnHomeRef.current = requestedFrom === 'home';
        queueMicrotask(() => {
          setEditingReminder(found);
          setEditorSession((session) => session + 1);
          setEditorVisible(true);
        });
      }
    }
    router.setParams({ member: undefined, reminderId: undefined, from: undefined });
  }, [loaded, requestedMember, requestedReminderId, requestedFrom, reminders]);

  const filteredReminders = useMemo(
    () =>
      selectedMember === 'All Members'
        ? reminders
        : reminders.filter((r) => (r.members ?? []).includes(selectedMember)),
    [reminders, selectedMember],
  );

  const visibleReminders = useMemo(
    () => (showAll ? filteredReminders : filteredReminders.slice(0, 3)),
    [filteredReminders, showAll],
  );

  const filteredCount = filteredReminders.length;

  const openNewReminder = () => {
    setEditingReminder(null);
    setEditorSession((session) => session + 1);
    setEditorVisible(true);
  };

  const openReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setEditorSession((session) => session + 1);
    setEditorVisible(true);
  };

  const saveReminder = async (reminder: Reminder) => {
    const isEditing = reminders.some((item) => item.id === reminder.id);
    try {
      const saved = withMembers(
        isEditing
          ? (await updateReminder(reminder), reminder)
          : await createReminder(reminder),
      );
      await scheduleReminderNotification(saved);
      setReminders((current) =>
        isEditing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setStorageError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save this reminder.';
      setStorageError(message);
      throw error;
    }
    setEditorVisible(false);
    setEditingReminder(null);
    returnHomeRef.current = false;
    setSuccessMessage(isEditing ? 'Changes saved' : 'Reminder added');
  };

  const deleteReminder = async (id: string) => {
    const index = reminders.findIndex((item) => item.id === id);
    if (index === -1) return;
    const removed = reminders[index];
    try {
      await deleteReminderRecord(removed);
      await cancelReminderNotification(removed.id);
      setReminders((current) => current.filter((item) => item.id !== id));
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not delete this reminder.');
      return;
    }
    setEditorVisible(false);
    setEditingReminder(null);
    returnHomeRef.current = false;

    if (undoTimer.current) clearTimeout(undoTimer.current);
    setDeletedItem({ reminder: removed, index });
    undoTimer.current = setTimeout(() => setDeletedItem(null), 5000);
  };

  const undoDelete = async () => {
    if (!deletedItem) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { reminder, index } = deletedItem;
    setDeletedItem(null);
    try {
      const restored = withMembers(await createReminder(reminder));
      await scheduleReminderNotification(restored);
      setReminders((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, restored);
        return next;
      });
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not restore this reminder.');
    }
  };

  const toggleReminder = async (id: string) => {
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return;
    const updated = { ...reminder, enabled: !reminder.enabled };
    try {
      await updateReminder(updated);
      if (updated.enabled) {
        await scheduleReminderNotification(updated);
      } else {
        await cancelReminderNotification(updated.id);
      }
      setReminders((current) => current.map((item) => (item.id === id ? updated : item)));
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not update this reminder.');
    }
  };

  const todayCount = reminders.filter((item) => item.enabled).length;
  const medicineCounts = overviewCounts(medicines);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      {!loaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: scaleFont(14), color: colors.mutedForeground }]}>
            Loading reminders...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {storageError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.expiringBackground }]}>
              <Ionicons name="information-circle-outline" size={17} color={colors.expiringForeground} />
              <Text style={[styles.errorText, { fontSize: scaleFont(12), color: colors.expiringForeground }]}>
                {storageError}
              </Text>
              <Pressable
                accessibilityLabel="Dismiss storage message"
                onPress={() => setStorageError('')}
                hitSlop={8}
              >
                <Ionicons name="close" size={17} color={colors.expiringForeground} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { fontSize: scaleFont(18), color: colors.foreground }]}>
              Upcoming Alerts
            </Text>
            {filteredCount > 3 ? (
              <Pressable
                accessibilityRole="button"
                testID="toggle-all-reminders"
                onPress={() => setShowAll((value) => !value)}
                hitSlop={8}
              >
                <Text style={[styles.viewAll, { fontSize: scaleFont(14), color: colors.primary }]}>
                  {showAll ? 'Show Less' : 'View All'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard
              count={String(medicineCounts.expired)}
              label="Expired"
              sublabel="Medicines"
              icon="ban-outline"
              background={colors.expiredBackground}
              border={colors.expiredBorder}
              foreground={colors.expiredForeground}
            />
            <SummaryCard
              count={String(medicineCounts.expiring)}
              label="Expiring"
              sublabel="Medicines"
              icon="alert-circle-outline"
              background={colors.expiringBackground}
              border={colors.expiringBorder}
              foreground={colors.expiringForeground}
            />
            <SummaryCard
              count={String(todayCount)}
              label="Reminders"
              sublabel="Today"
              icon="calendar-outline"
              background={colors.todayBackground}
              border={colors.todayBorder}
              foreground={colors.todayForeground}
            />
            <SummaryCard
              count={String(reminders.length)}
              label="Total"
              sublabel="Reminders"
              icon="notifications"
              background={colors.totalBackground}
              border={colors.totalBorder}
              foreground={colors.totalForeground}
            />
          </View>

          <View style={styles.listHeading}>
            <View>
              <Text style={[styles.listTitle, { fontSize: scaleFont(16), color: colors.foreground }]}>
                Today - {todayLabel}
              </Text>
              {selectedMember !== 'All Members' ? (
                <Text style={[styles.filterCaption, { fontSize: scaleFont(12), color: colors.mutedForeground }]}>
                  Showing {selectedMember}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.countText, { fontSize: scaleFont(13), color: colors.mutedForeground }]}>
              {filteredCount} {filteredCount === 1 ? 'reminder' : 'reminders'}
            </Text>
          </View>

          {visibleReminders.length ? (
            <View style={styles.reminderList}>
              {visibleReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onPress={() => openReminder(reminder)}
                  onToggle={() => toggleReminder(reminder.id)}
                  colors={colors}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
                <Ionicons name="alarm-outline" size={23} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { fontSize: scaleFont(15), color: colors.foreground }]}>
                No reminders for {selectedMember}
              </Text>
              <Text style={[styles.emptyText, { fontSize: scaleFont(13), color: colors.mutedForeground }]}>
                Add a reminder or choose another family member.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View
        style={[
          styles.footer,
          {
            backgroundColor: displayColors.surfacePrimary,
            borderTopColor: displayColors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          testID="add-reminder-button"
          onPress={openNewReminder}
          style={({ pressed }) => [
            styles.addReminderButton,
            {
              backgroundColor: displayColors.actionPrimary,
              opacity: pressed ? 0.86 : 1,
              marginTop: 0,
            },
          ]}
        >
          <Ionicons name="add" size={20} color={displayColors.onAction} />
          <Text
            style={[type.label, styles.addReminderText, { color: displayColors.onAction }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            Add Reminder
          </Text>
        </Pressable>
      </View>

      <ReminderEditorModal
        key={`${editingReminder?.id ?? 'new-reminder'}-${editorSession}`}
        visible={editorVisible}
        reminder={editingReminder}
        onClose={() => {
          setEditorVisible(false);
          setEditingReminder(null);
          if (returnHomeRef.current) {
            returnHomeRef.current = false;
            router.navigate('/(tabs)');
          }
        }}
        onSave={saveReminder}
        onDelete={deleteReminder}
      />

      <FilterModal
        visible={filterVisible}
        selectedMember={pendingMember}
        onSelect={setPendingMember}
        onClose={() => setFilterVisible(false)}
        onApply={() => {
          setSelectedMember(pendingMember);
          setShowAll(true);
          setFilterVisible(false);
        }}
        colors={colors}
        members={profiles.map((profile) => profile.profile_display_name)}
        bottomInset={insets.bottom}
      />

      <Modal
        visible={Boolean(successMessage)}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSuccessMessage('')}
      >
        <View style={[styles.successBackdrop, { backgroundColor: colors.overlayStrong }]}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="checkmark" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.successTitle, { fontSize: scaleFont(17), color: colors.foreground }]}>
              {successMessage}
            </Text>
            <Text style={[styles.successCopy, { fontSize: scaleFont(13), color: colors.mutedForeground }]}>
              Your reminder list has been updated.
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="dismiss-success"
              onPress={() => setSuccessMessage('')}
              style={[styles.successButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.successButtonText, { fontSize: scaleFont(14), color: colors.primaryForeground }]}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(deletedItem)}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setDeletedItem(null)}
      >
        <View style={[styles.successBackdrop, { backgroundColor: colors.overlayStrong }]}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <Pressable
              accessibilityLabel="Close"
              onPress={() => setDeletedItem(null)}
              hitSlop={10}
              style={styles.popupClose}
            >
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>

            <View style={[styles.successIcon, { backgroundColor: colors.expiredBackground }]}>
              <Ionicons name="trash-outline" size={22} color={colors.expiredForeground} />
            </View>
            <Text style={[styles.successTitle, { fontSize: scaleFont(17), color: colors.foreground }]}>
              Reminder Deleted
            </Text>
            <Text style={[styles.successCopy, { fontSize: scaleFont(13), color: colors.mutedForeground }]}>
              {deletedItem?.reminder.medicine}
            </Text>

            <Pressable
              accessibilityRole="button"
              testID="undo-delete"
              onPress={() => void undoDelete()}
              style={[styles.successButton, { backgroundColor: colors.accent, flexDirection: 'row', gap: 6 }]}
            >
              <Ionicons name="arrow-undo-outline" size={15} color={colors.primary} />
              <Text style={[styles.successButtonText, { fontSize: scaleFont(14), color: colors.primary }]}>
                Undo
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type SummaryCardProps = {
  count: string;
  label: string;
  sublabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  background: string;
  border: string;
  foreground: string;
};

function SummaryCard({
  count,
  label,
  sublabel,
  icon,
  background,
  border,
  foreground,
}: SummaryCardProps) {
  const { scaleFont } = useDisplayTheme();
  return (
    <View style={[styles.summaryCard, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.summaryCount, { fontSize: scaleFont(18), color: foreground }]}>{count}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.summaryLabel, { fontSize: scaleFont(11), color: foreground }]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.summarySublabel, { fontSize: scaleFont(10), color: foreground }]}
      >
        {sublabel}
      </Text>
      <Ionicons name={icon} size={15} color={foreground} style={styles.summaryIcon} />
    </View>
  );
}

type ReminderCardProps = {
  reminder: Reminder;
  onPress: () => void;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
};

function ReminderCard({ reminder, onPress, onToggle, colors }: ReminderCardProps) {
  const { scaleFont } = useDisplayTheme();
  return (
    <View
      style={[
        styles.reminderCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${reminder.medicine} reminder at ${reminder.time}`}
        testID={`reminder-card-${reminder.id}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.reminderCardContent,
          { opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={styles.timeColumn}>
          <Text style={[styles.timeText, { fontSize: scaleFont(12), color: colors.foreground }]}>
            {reminder.time}
          </Text>
          <Ionicons
            name="sunny-outline"
            size={17}
            color={colors.expiringBorder}
            style={styles.sunIcon}
          />
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        <View style={styles.reminderInfo}>
          <Text
            numberOfLines={1}
            style={[styles.reminderMedicine, { fontSize: scaleFont(15), color: colors.foreground }]}
          >
            {reminder.medicine}
          </Text>
          <Text style={[styles.reminderMeta, { fontSize: scaleFont(13), color: colors.mutedForeground }]}>
            {reminder.category}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.reminderInstructions, { fontSize: scaleFont(13), color: colors.foreground }]}
          >
            {reminder.instructions || reminder.frequency}
          </Text>
          <View style={styles.memberLine}>
            <View style={[styles.memberAvatar, { backgroundColor: colors.accent }]}>
              <Ionicons name="person" size={10} color={colors.primary} />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.memberName, { fontSize: scaleFont(12), color: colors.mutedForeground }]}
            >
              {(reminder.members ?? []).join(', ')}
            </Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Turn ${reminder.enabled ? 'off' : 'on'} ${reminder.medicine} alert`}
        accessibilityState={{ checked: reminder.enabled }}
        testID={`toggle-reminder-${reminder.id}`}
        onPress={onToggle}
        hitSlop={8}
        style={styles.bellButton}
      >
        <Ionicons
          name={reminder.enabled ? 'notifications-outline' : 'notifications-off-outline'}
          size={19}
          color={reminder.enabled ? colors.primary : colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

type FilterModalProps = {
  visible: boolean;
  selectedMember: string;
  onSelect: (member: string) => void;
  onClose: () => void;
  onApply: () => void;
  colors: ReturnType<typeof useColors>;
  members: string[];
  bottomInset: number;
};

function FilterModal({
  visible,
  selectedMember,
  onSelect,
  onClose,
  onApply,
  colors,
  members,
  bottomInset,
}: FilterModalProps) {
  const { colors: displayColors, type, scaleFont } = useDisplayTheme();
  const people = ['All Members', ...members];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.filterRoot}>
        <Pressable
          accessibilityLabel="Close family filter"
          onPress={onClose}
          style={[styles.filterBackdrop, { backgroundColor: colors.overlay }]}
        />
        <View
          style={[
            styles.filterSheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(bottomInset, 14) },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.filterTitleRow}>
            <Text style={[styles.filterTitle, { fontSize: scaleFont(17), color: colors.foreground }]}>
              Filter by Family Member
            </Text>
            <Pressable
              accessibilityLabel="Close"
              testID="close-reminder-filter"
              onPress={onClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={21} color={colors.foreground} />
            </Pressable>
          </View>
          <Text style={[styles.filterSubtitle, { fontSize: scaleFont(13), color: colors.mutedForeground }]}>
            Show the daily timeline for:
          </Text>
          <ScrollView
            style={styles.filterList}
            contentContainerStyle={styles.filterListContent}
            showsVerticalScrollIndicator={false}
          >
            {people.map((person, index) => {
              const selected = selectedMember === person;
              return (
                <Pressable
                  key={person}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  testID={`filter-${person.toLowerCase().split(' ').join('-')}`}
                  onPress={() => onSelect(person)}
                  style={[
                    styles.filterOption,
                    { borderColor: selected ? colors.todayBorder : colors.border },
                    selected && { backgroundColor: colors.accent },
                  ]}
                >
                  <View
                    style={[
                      styles.filterAvatar,
                      { backgroundColor: index === 0 ? colors.accent : colors.secondary },
                    ]}
                  >
                    <Ionicons
                      name={index === 0 ? 'people-outline' : 'person-outline'}
                      size={17}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.filterMember, { fontSize: scaleFont(14), color: colors.foreground }]}>
                    {person}
                  </Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={19}
                    color={selected ? colors.todayForeground : colors.border}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            testID="apply-reminder-filter"
            onPress={onApply}
            style={({ pressed }) => [
              styles.addReminderButton,
              { backgroundColor: displayColors.actionPrimary, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <Text style={[type.label, styles.addReminderText, { color: displayColors.onAction }]}>
              Apply Filter
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  errorBanner: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 13,
  },
  errorText: { flex: 1, lineHeight: 16 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  sectionTitle: { fontWeight: '700' },
  viewAll: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 7 },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 98,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  summaryCount: { fontWeight: '800', marginBottom: 3 },
  summaryLabel: { fontWeight: '700', textAlign: 'center' },
  summarySublabel: { textAlign: 'center', marginTop: 1 },
  summaryIcon: { marginTop: 6 },
  listHeading: {
    marginTop: 21,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: { fontWeight: '700' },
  filterCaption: { marginTop: 3 },
  countText: {},
  reminderList: { gap: 8 },
  reminderCard: {
    minHeight: 103,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reminderCardContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeColumn: {
    width: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  timeText: { fontWeight: '600', textAlign: 'center' },
  sunIcon: { marginTop: 2 },
  cardDivider: { width: 1, height: 68, marginHorizontal: 9 },
  reminderInfo: { flex: 1, minWidth: 0 },
  reminderMedicine: { fontWeight: '700' },
  reminderMeta: { marginTop: 1 },
  reminderInstructions: { marginTop: 2 },
  memberLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  memberAvatar: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { flex: 1 },
  bellButton: { padding: 6, marginLeft: 4 },
  emptyCard: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 13,
    padding: 18,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontWeight: '700', textAlign: 'center' },
  emptyText: { lineHeight: 18, textAlign: 'center', marginTop: 5 },
  addReminderButton: {
    minHeight: 48,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  addReminderText: { fontWeight: '700' },
  filterRoot: { flex: 1, justifyContent: 'flex-end' },
  filterBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  filterSheet: {
    maxHeight: '82%',
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 11,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: { fontWeight: '700' },
  filterSubtitle: { marginTop: 10, marginBottom: 8 },
  filterList: { flexGrow: 0 },
  filterListContent: { gap: 6, paddingBottom: 5 },
  filterOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    gap: 8,
  },
  filterAvatar: {
    width: 29,
    height: 29,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterMember: { flex: 1, fontWeight: '600' },
  successBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  successCard: {
    width: '100%',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successTitle: { fontWeight: '700' },
  successCopy: { textAlign: 'center', marginTop: 5, marginBottom: 15 },
  successButton: {
    width: '100%',
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonText: { fontWeight: '700' },
  popupClose: { position: 'absolute', top: 12, right: 12 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});