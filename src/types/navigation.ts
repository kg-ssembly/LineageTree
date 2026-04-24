export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  TreeDetail: {
    treeId: string;
    treeName?: string;
  };
  PersonProfile: {
    treeId: string;
    personId: string;
    personName?: string;
  };
};

