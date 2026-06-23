import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  tree: undefined;
  members: undefined;
  notifications: undefined;
  treeSettings: undefined;
  myProfile: undefined;
};

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
  };
};
