import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  home: undefined;
  notifications: undefined;
  tree: undefined;
  members: undefined;
  treeSettings: undefined;
  myProfile: undefined;
};

export type PersonProfileRouteTab = 'biography' | 'relationships' | 'memories-gallery';
export type PersonProfileRouteMemorySection = 'notes' | 'photos' | 'events';

// Legacy — used by tree-detail-screen.tsx (kept for compatibility)
export type TreeDetailTabParamList = {
  PeopleRelationshipsTab: undefined;
  VisualisationTab: undefined;
  ProfileTab: undefined;
  HomeTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  TreeDetail: { treeId: string; initialTab?: keyof TreeDetailTabParamList; returnTreeId?: string };
  PersonProfile: {
    treeId: string;
    personId: string;
    initialTab?: PersonProfileRouteTab;
    initialMemorySectionTab?: PersonProfileRouteMemorySection;
  };
};
