import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../../components/dto/navigation';

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
      Main: {
        path: '',
        screens: {
          home: '',
          tree: 'tree',
          members: 'members',
          treeSettings: 'settings',
          myProfile: 'profile',
        },
      },
      TreeDetail: 'trees/:treeId',
      PersonProfile: 'trees/:treeId/family-members/:personId',
    },
  },
};

export default linking;
