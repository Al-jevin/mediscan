import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Components, Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { resetListQuery, setListQuery, useListQuery, type ListScope } from '@/services/listQueryStore';
import {
  commitDelete, deleteWithUndo, UNDO_SECONDS, undoDelete, usePendingDeletes,
} from '@/services/vaultStore';
import type { StatusFilter, UrgencyFilter, VaultMedicine } from '@/types/medicine';
import { activeSheetFilterCount, applyQuery, medicineName } from '@/utils/medicine';
import CardMenu from './CardMenu';
import MedicineCard, { type Anchor } from './MedicineCard';
import Popup from './Popup';

type Props = {
  scope: ListScope;
  medicines: VaultMedicine[];
  ready: boolean;
  error?: string | null;
  onRetry?: () => void;
  initialFilter?: string;
};

export default function MedicineList({ scope, medicines, ready, error, onRetry, initialFilter }: Props) {
  const router = useRouter();
  const { colors, isDark } = useDisplayTheme();
  const query = useListQuery(scope);
  const [searchFocused, setSearchFocused] = useState(false);
  const shown = useMemo(() => applyQuery(medicines, query), [medicines, query]);
  const sheetCount = activeSheetFilterCount(query);

  const chipBg = isDark ? colors.surfaceSecondary : colors.surfacePrimary;
  const chips: { key: StatusFilter; label: string; icon?: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { key: 'all', label: 'All', color: colors.textPrimary },
    { key: 'verified', label: 'Verified', icon: 'checkmark', color: colors.statusSuccess },
    { key: 'needs_verification', label: 'Needs Verification', icon: 'warning-outline', color: colors.statusWarning },
    { key: 'expired', label: 'Expired', icon: 'ban-outline', color: colors.statusDanger },
  ];

  useEffect(() => {
    if (initialFilter) {
      const normalized = initialFilter.toLowerCase();
      let targetStatus: StatusFilter = 'all';
      let urgency: UrgencyFilter = 'none';

      if (normalized.includes('need')) {
        targetStatus = 'needs_verification';
      } else if (normalized.includes('expiring')) {
        urgency = 'within30';
      } else if (normalized.includes('expir')) {
        targetStatus = 'expired';
      } else if (normalized.includes('verif')) {
        targetStatus = 'verified';
      }

      setListQuery(scope, { status: targetStatus, urgency });
    }
  }, [initialFilter, scope]);

  const [menu, setMenu] = useState<{ medicine: VaultMedicine; anchor: Anchor } | null>(null);
  const [confirm, setConfirm] = useState<VaultMedicine | null>(null);
  const [deleted, setDeleted] = useState<{ id: string; name: string } | null>(null);
  const pending = usePendingDeletes();
  const deletedVisible = !!deleted && pending.includes(deleted.id);
  const secondsLeft = useCountdown(deletedVisible ? deleted?.id ?? null : null);

  const openDetails = (m: VaultMedicine) =>
    router.push({ pathname: '/medicine/[id]', params: { id: m.vault_id } });

  const confirmDelete = () => {
    if (!confirm) return;
    deleteWithUndo(confirm.vault_id);
    setDeleted({ id: confirm.vault_id, name: medicineName(confirm) });
    setConfirm(null);
  };

  const hasQuery = query.search.trim() !== '' || query.status !== 'all' || sheetCount > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.surfacePrimary }]}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: chipBg,
              borderColor: searchFocused ? colors.statusWarning : colors.borderDefault,
            },
          ]}
        >
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            value={query.search}
            onChangeText={(t) => setListQuery(scope, { search: t })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search medicines..."
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search medicines"
          />
          {query.search ? (
            <Pressable onPress={() => setListQuery(scope, { search: '' })} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Ionicons name="search" size={20} color={colors.textPrimary} />
          )}
        </View>
        <Pressable
          style={styles.filterBtn}
          onPress={() => router.push({ pathname: '/vault-filters', params: { scope } })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={sheetCount ? `Filters, ${sheetCount} on` : 'Filters'}
        >
          <Ionicons name="options-outline" size={26} color={colors.textPrimary} />
          {sheetCount > 0 && (
            <View style={[styles.filterDot, { backgroundColor: colors.statusSuccess }]}>
              <Text style={[styles.filterDotText, { color: colors.onAction }]}>{sheetCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((c) => {
            const on = query.status === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setListQuery(scope, { status: c.key })}
                style={[
                  on ? Components.chipSelected : Components.chip,
                  styles.chip,
                  on
                    ? { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }
                    : {
                        backgroundColor: chipBg,
                        borderColor: c.key !== 'all' ? c.color : colors.borderDefault,
                      },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                {c.icon && <Ionicons name={c.icon} size={16} color={on ? colors.onAction : c.color} />}
                <Text style={[styles.chipText, { color: on ? colors.onAction : c.color }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.countRow}>
        <Text style={[styles.count, { color: colors.textPrimary }]}>
          {shown.length} {shown.length === 1 ? 'Medicine' : 'Medicines'}
        </Text>
        <Pressable
          style={styles.sortBtn}
          onPress={() => setListQuery(scope, { sort: query.sort === 'az' ? 'za' : 'az' })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={query.sort === 'az' ? 'Sorted A to Z. Tap for Z to A' : 'Sorted Z to A. Tap for A to Z'}
        >
          <Text style={[styles.sortText, { color: colors.textPrimary }]}>
            {query.sort === 'az' ? 'A–Z' : 'Z–A'}
          </Text>
          <Ionicons name="swap-vertical" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.actionPrimary} />
        </View>
      ) : error && medicines.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load your vault"
          message={error}
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : (
        <>
          {error ? (
            <Text style={[styles.errorText, { color: colors.statusDanger }]}>{error}</Text>
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={(m) => m.vault_id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm + 4 }} />}
            renderItem={({ item }) => (
              <MedicineCard
                medicine={item}
                onPress={openDetails}
                onMenu={(m, anchor) => setMenu({ medicine: m, anchor })}
              />
            )}
            ListEmptyComponent={
              medicines.length === 0 ? (
                <EmptyState
                  icon="shield-outline"
                  title="Your vault is empty"
                  message="Tap the + button below to scan a medicine or enter it manually."
                />
              ) : (
                <EmptyState
                  icon="search-outline"
                  title="No medicines found"
                  message="Try a different search, or clear the filters."
                  actionLabel={hasQuery ? 'Clear search & filters' : undefined}
                  onAction={() => resetListQuery(scope, { sort: query.sort })}
                />
              )
            }
          />
        </>
      )}

      <CardMenu
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'View Details', icon: 'information-circle-outline', onPress: () => openDetails(menu.medicine) },
                {
                  label: menu.medicine.vault_note ? 'Edit Note' : 'Add Note',
                  icon: 'create-outline',
                  onPress: () => router.push({ pathname: '/add-note', params: { id: menu.medicine.vault_id } }),
                },
                { label: 'Delete', icon: 'trash-outline', danger: true, onPress: () => setConfirm(menu.medicine) },
              ]
            : []
        }
      />

      <Popup
        visible={!!confirm || deletedVisible}
        icon="trash-outline"
        tone="danger"
        {...(confirm
          ? {
              title: 'Delete this medicine?',
              message: `Are you sure you want to delete ${medicineName(confirm)}? You can undo this within ${UNDO_SECONDS} seconds.`,
              onClose: () => setConfirm(null),
              actions: [
                { label: 'Cancel', variant: 'secondary' as const, onPress: () => setConfirm(null) },
                { label: 'Delete', variant: 'danger' as const, onPress: confirmDelete },
              ],
            }
          : {
              title: 'Medicine Deleted',
              message: deleted ? `${deleted.name} was removed from your list.` : '',
              stacked: true,
              onClose: () => {
                if (deleted) commitDelete(deleted.id);
              },
              actions: [
                {
                  label: 'Done',
                  onPress: () => {
                    if (deleted) commitDelete(deleted.id);
                  },
                },
                {
                  label: `Undo (${secondsLeft}s)`,
                  icon: 'arrow-undo' as const,
                  variant: 'soft' as const,
                  onPress: () => {
                    if (deleted) undoDelete(deleted.id);
                  },
                },
              ],
            })}
      />
    </View>
  );
}

function useCountdown(key: string | null): number {
  const [left, setLeft] = useState(UNDO_SECONDS);
  useEffect(() => {
    if (!key) return;
    const started = Date.now();
    setLeft(UNDO_SECONDS);
    const t = setInterval(() => {
      setLeft(Math.max(0, UNDO_SECONDS - Math.floor((Date.now() - started) / 1000)));
    }, 250);
    return () => clearInterval(t);
  }, [key]);
  return left;
}

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, isDark } = useDisplayTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name={icon} size={32} color={colors.actionPrimary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable
          style={[
            Components.buttonSecondary,
            {
              marginTop: Spacing.md,
              backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
              borderColor: colors.borderDefault,
            },
          ]}
          onPress={onAction}
        >
          <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4, paddingHorizontal: Spacing.md + 4, paddingTop: Spacing.md },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  searchInput: { flex: 1, ...Type.body, paddingVertical: 0, outlineWidth: 0 },
  filterBtn: { padding: Spacing.xs },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterDotText: { fontSize: 11, fontWeight: '700' },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.md + 4, paddingVertical: Spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm + 4, minHeight: 36 },
  chipText: { ...Type.caption, fontWeight: '600' },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 4,
    paddingBottom: Spacing.sm,
  },
  count: { ...Type.h3 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.xs },
  sortText: { ...Type.label },
  list: { paddingHorizontal: Spacing.md + 4, paddingTop: Spacing.xs, paddingBottom: Spacing.xl * 2, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl * 1.5, paddingHorizontal: Spacing.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { ...Type.h3, textAlign: 'center' },
  emptyMsg: { ...Type.body, textAlign: 'center', marginTop: Spacing.xs },
  errorText: { ...Type.caption, paddingHorizontal: Spacing.md + 4 },
});