import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '../../constants/styles';
import { useI18n } from '../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../i18n/keys';

/** A scrollable dialog that docks above the safe area on small screens. */
export function AdaptiveDialog({ visible, onDismiss, title, children, actions }: {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobile = width < 600;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: mobile ? 'flex-end' : 'center', paddingTop: insets.top + 12, paddingBottom: mobile ? 0 : insets.bottom + 12, backgroundColor: theme.colors.backdrop }}>
        <Pressable accessibilityLabel={t(K.common.close)} accessible={false} onPress={onDismiss} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <View accessibilityViewIsModal accessibilityLabel={title} role="dialog" style={[GlobalStyles.dialogChrome.dialog, { backgroundColor: theme.colors.surface, width: mobile ? '100%' : '94%', maxWidth: 520, marginHorizontal: 0, maxHeight: height - insets.top - (mobile ? 12 : insets.bottom + 24), paddingTop: 48, borderBottomLeftRadius: mobile ? 0 : 20, borderBottomRightRadius: mobile ? 0 : 20 }]}>
          <IconButton icon="close" size={24} onPress={onDismiss} style={[GlobalStyles.dialogChrome.closeButton, { zIndex: 1 }]} accessibilityLabel={t(K.common.close)} />
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {actions ? <View style={{ padding: 16, paddingBottom: Math.max(16, insets.bottom), borderTopWidth: 1, borderColor: theme.colors.outlineVariant, gap: 10 }}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
