import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { TermsLegalText } from './TermsMedicalDisclaimerContent';

interface TermsConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const END_THRESHOLD_PX = 24;

export default function TermsConsentModal({
  visible,
  onAccept,
  onReject,
}: TermsConsentModalProps) {
  const { colors } = useDisplayTheme();
  const insets = useSafeAreaInsets();
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);

  useEffect(() => {
    if (visible) {
      setHasReachedEnd(false);
    }
  }, [visible]);

  const checkFitsWithoutScroll = () => {
    if (
      viewportHeight.current > 0 &&
      contentHeight.current > 0 &&
      contentHeight.current <= viewportHeight.current + END_THRESHOLD_PX
    ) {
      setHasReachedEnd(true);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (hasReachedEnd) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - END_THRESHOLD_PX) {
      setHasReachedEnd(true);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onReject}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Terms &amp; Conditions</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Please review and accept our PH-compliant terms, privacy policy, and medical disclaimer to create your account.
            </Text>
          </View>

          <ScrollView
            style={[
              styles.scrollArea,
              { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
            ]}
            contentContainerStyle={styles.scrollInner}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onLayout={(e) => {
              viewportHeight.current = e.nativeEvent.layout.height;
              checkFitsWithoutScroll();
            }}
            onContentSizeChange={(_w, h) => {
              contentHeight.current = h;
              checkFitsWithoutScroll();
            }}
          >
            <TermsLegalText />
          </ScrollView>

          {!hasReachedEnd && (
            <View style={styles.scrollHint}>
              <Ionicons name="arrow-down-circle-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.scrollHintText, { color: colors.textMuted }]}>
                Scroll to the bottom to read all terms before agreeing.
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.rejectBtn,
                { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
              ]}
              activeOpacity={0.8}
              onPress={onReject}
            >
              <Text style={[styles.rejectBtnText, { color: colors.danger }]}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acceptBtn,
                { backgroundColor: hasReachedEnd ? colors.primary : colors.border },
                !hasReachedEnd && { opacity: 0.6 },
              ]}
              activeOpacity={0.8}
              onPress={onAccept}
              disabled={!hasReachedEnd}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasReachedEnd }}
              accessibilityHint={
                hasReachedEnd ? undefined : 'Scroll to the bottom of the terms to enable this button'
              }
            >
              <Text
                style={[
                  styles.acceptBtnText,
                  { color: hasReachedEnd ? colors.onAction : colors.textMuted },
                ]}
              >
                I Agree &amp; Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  scrollArea: {
    maxHeight: 340,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 12,
  },
  scrollInner: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  acceptBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  scrollHintText: {
    fontSize: 12,
  },
  acceptBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
});