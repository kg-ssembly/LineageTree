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
  Main: undefined;
  // Legacy — tree-detail-screen.tsx kept for reference; no longer in the navigator
  TreeDetail: { treeId: string; initialTab?: keyof TreeDetailTabParamList };
  PersonProfile: {
    treeId: string;
    personId: string;
  };
};
