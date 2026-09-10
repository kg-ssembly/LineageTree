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
      JoinTree: 'join/:treeId',
      Login: 'login',
      SignUp: 'signup',
      Main: {
        path: '',
        screens: {
          home: 'home',
          notifications: 'notifications',
          tree: 'tree',
          members: 'members',
          treeSettings: 'settings',
          myProfile: 'profile',
        },
      },
      PersonProfile: 'trees/:treeId/family-members/:personId',
    },
  },
};

export default linking;
