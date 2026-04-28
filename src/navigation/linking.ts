import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList, TreeDetailTabParamList } from '../../components/dto/navigation';

const tabPathByKey: Record<keyof TreeDetailTabParamList, string> = {
  PeopleRelationshipsTab: 'family-members',
  VisualisationTab: 'visualisation',
  ProfileTab: 'profile',
  HomeTab: 'home',
};

const tabKeyByPath = Object.fromEntries(
  Object.entries(tabPathByKey).map(([key, value]) => [value, key]),
) as Record<string, keyof TreeDetailTabParamList>;

function parseTreeTabPath(value?: string): keyof TreeDetailTabParamList | undefined {
  if (!value) {
    return undefined;
  }

  return tabKeyByPath[value] ?? undefined;
}

function stringifyTreeTabPath(value?: keyof TreeDetailTabParamList): string {
  if (!value) {
    return '';
  }

  return tabPathByKey[value] ?? '';
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'lineagetree://',
    'https://lineagetree.web.app',
    'https://lineagetree.firebaseapp.com',
  ],
  config: {
    screens: {
      Login: 'login',
      SignUp: 'signup',
      Home: '',
      TreeDetail: {
        path: 'trees/:treeId/:initialTab?',
        parse: {
          initialTab: parseTreeTabPath,
        },
        stringify: {
          initialTab: stringifyTreeTabPath,
        },
      },
      PersonProfile: 'trees/:treeId/family-members/:personId',
    },
  },
};

export default linking;

