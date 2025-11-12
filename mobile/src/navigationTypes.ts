// Central place for navigation param types to avoid import cycles
export type RootStackParamList = {
  Login: undefined;
  RouteList: { saved?: boolean; savedOffline?: boolean } | undefined;
  VisitDetail: { id: number };
  Home: undefined;
  About: undefined;
  DeleteAccount: undefined;
  Account: undefined;
  FieldTechnicians: { mode?: 'all' } | undefined;
  ClientLocations: { mode?: 'all' } | undefined;
  ServiceRoutes: { mode?: 'all' } | undefined;
};
