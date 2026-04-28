export type TreeDetailTabParamList = {
  PeopleRelationshipsTab: undefined;
  VisualisationTab: undefined;
  ProfileTab: undefined;
  HomeTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: {
    skipAutoOpen?: boolean;
  } | undefined;
  TreeDetail: {
    treeId: string;
    initialTab?: keyof TreeDetailTabParamList;
  };
  PersonProfile: {
    treeId: string;
    personId: string;
  };
};

