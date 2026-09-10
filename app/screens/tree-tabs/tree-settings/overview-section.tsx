import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles, Reveal, SectionCard } from '../../../../components';
import { getTreeKinshipSystem, isTreeDiscoverable, treeNeedsDiscoverabilityChoice } from '../../../../components/dto/tree';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { LANGUAGE_OPTIONS } from '../../../../i18n';
import type { OverviewSectionProps } from './tree-settings-shared';
import { formatRole, getTreeSettingsFamilyMemberCardStyle } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;
const KINSHIP_LANGUAGE_OPTIONS = ['nso', 'ss', 'st', 'tn', 'ts', 've', 'zu'] as const;

export function OverviewSection({
  selectedTree,
  people,
  role,
  isOwner,
  mutating,
  treeSurnameVariants,
  unlinkedCollaboratorCount,
  onOpenHelperDialog,
  onOpenSurnameVariantDialog,
  onSetTreeDiscoverability,
  onSetTreeKinshipSystem,
}: OverviewSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [kinshipMenuVisible, setKinshipMenuVisible] = useState(false);

  const kinshipOptions = useMemo(
    () => [
      {
        code: 'auto' as const,
        label: t(K.treeSettings.kinshipTermsAuto),
      },
      {
        code: 'generic' as const,
        label: t(K.treeSettings.kinshipTermsGeneric),
      },
      ...KINSHIP_LANGUAGE_OPTIONS.map((code) => {
      const language = LANGUAGE_OPTIONS.find((option) => option.code === code);
      return {
        code,
        label: language?.nativeName ?? code,
      };
      }),
    ],
    [t],
  );

  const selectedKinshipSystem = getTreeKinshipSystem(selectedTree);
  const selectedKinshipOption = kinshipOptions.find((option) => option.code === selectedKinshipSystem);

  useEffect(() => {
    if (mutating) {
      setKinshipMenuVisible(false);
    }
  }, [mutating]);

  return (
    <>
      <View style={styles.summaryChipRow}>
        <Chip icon="account-key">{formatRole(role)}</Chip>
        <Chip icon="account-group">{t(K.treeSettings.familyMembersCount, { count: people.length })}</Chip>
        <Chip icon="account-multiple">{t(K.treeSettings.collaboratorsCount, { count: selectedTree.collaborators.length })}</Chip>
        {unlinkedCollaboratorCount > 0 ? <Chip icon="account-clock">{t(K.treeSettings.awaitingLinkCount, { count: unlinkedCollaboratorCount })}</Chip> : null}
      </View>

      <Reveal delay={80}>
        <SectionCard style={[styles.selfAssignmentCard, getTreeSettingsFamilyMemberCardStyle(theme), { marginBottom: 12 }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">{t(K.treeSettings.treeDiscoverability)}</Text>
              </View>
            </View>
            <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
              {treeNeedsDiscoverabilityChoice(selectedTree)
                ? t(K.treeSettings.treeDiscoverabilityPrompt)
                : isTreeDiscoverable(selectedTree)
                  ? t(K.treeSettings.treeDiscoverabilityOn)
                  : t(K.treeSettings.treeDiscoverabilityOff)}
            </Text>
            {isOwner ? (
              <View style={[styles.collaboratorChipRow, { marginTop: 12 }]}>
                <Button
                  mode={isTreeDiscoverable(selectedTree) ? 'contained' : 'outlined'}
                  onPress={() => { void onSetTreeDiscoverability(true); }}
                  disabled={mutating}
                  style={BUTTON_CHROME}
                  contentStyle={BUTTON_CONTENT_CHROME}
                >
                  {t(K.treeSettings.makeTreeDiscoverable)}
                </Button>
                <Button
                  mode={!isTreeDiscoverable(selectedTree) && !treeNeedsDiscoverabilityChoice(selectedTree) ? 'contained' : 'outlined'}
                  onPress={() => { void onSetTreeDiscoverability(false); }}
                  disabled={mutating}
                  style={BUTTON_CHROME}
                  contentStyle={BUTTON_CONTENT_CHROME}
                >
                  {t(K.treeSettings.keepTreePrivate)}
                </Button>
              </View>
            ) : null}
        </SectionCard>
      </Reveal>

      <Reveal delay={85}>
        <SectionCard style={[styles.selfAssignmentCard, getTreeSettingsFamilyMemberCardStyle(theme), { marginBottom: 12 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="titleLarge">{t(K.treeSettings.kinshipTerms)}</Text>
            </View>
          </View>
          <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
            {t(K.treeSettings.kinshipTermsSummary)}
          </Text>
          <View style={[styles.collaboratorChipRow, { marginTop: 12 }]}>
            <Chip compact icon="account-switch">
              {selectedKinshipOption?.label ?? selectedKinshipSystem}
            </Chip>
            {isOwner ? (
              <Menu
                visible={kinshipMenuVisible}
                onDismiss={() => setKinshipMenuVisible(false)}
                anchor={(
                  <Button
                    mode="outlined"
                    icon="chevron-down"
                    onPress={() => setKinshipMenuVisible(true)}
                    disabled={mutating}
                    style={BUTTON_CHROME}
                    contentStyle={BUTTON_CONTENT_CHROME}
                  >
                    {t(K.common.edit)}
                  </Button>
                )}
              >
                {kinshipOptions.map(({ code, label }) => (
                  <Menu.Item
                    key={`kinship-option-${code}`}
                    leadingIcon={selectedKinshipSystem === code ? 'check' : undefined}
                    onPress={() => {
                      setKinshipMenuVisible(false);
                      void onSetTreeKinshipSystem(code);
                    }}
                    title={label}
                  />
                ))}
              </Menu>
            ) : null}
          </View>
        </SectionCard>
      </Reveal>

      <Reveal delay={90}>
        <SectionCard style={[styles.selfAssignmentCard, getTreeSettingsFamilyMemberCardStyle(theme), { marginBottom: 8 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="titleLarge">{t(K.treeSettings.surnameVariants)}</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  style={styles.helperIconButton}
                  onPress={() => onOpenHelperDialog('surname-variants')}
                  accessibilityLabel={t(K.treeSettings.aboutSurnameVariants)}
                />
              </View>
            </View>
          </View>

          {treeSurnameVariants.length > 0 ? (
            <View style={[styles.collaboratorChipRow, { marginTop: 16 }]}>
              {treeSurnameVariants.map((variant) => <Chip key={`tree-variant-${variant}`} compact>{variant}</Chip>)}
            </View>
          ) : null}

          {isOwner || role === 'editor' ? (
            <View style={{ marginTop: 8 }}>
              <Button mode="outlined" icon="shape-plus-outline" onPress={onOpenSurnameVariantDialog} style={[BUTTON_CHROME, { marginBottom: 8 }]} contentStyle={BUTTON_CONTENT_CHROME}>
                {treeSurnameVariants.length > 0 ? t(K.treeSettings.manageVariantsCount, { count: treeSurnameVariants.length }) : t(K.treeSettings.manageVariants)}
              </Button>
            </View>
          ) : null}
        </SectionCard>
      </Reveal>

    </>
  );
}
