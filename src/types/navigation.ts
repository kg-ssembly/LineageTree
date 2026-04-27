export type TreeDetailTabParamList = {
  PeopleRelationshipsTab: undefined;
  IntelligenceTab: undefined;
  VisualisationTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  TreeDetail: {
    treeId: string;
    initialTab?: keyof TreeDetailTabParamList;
  };
  PersonProfile: {
    treeId: string;
    personId: string;
  };
};

