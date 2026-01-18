import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminAssignServiceRoute, adminFetchClients, adminFetchServiceRoutes, adminFetchUsers, AdminClient, AdminUser, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import HeaderEmailChip from '../components/HeaderEmailChip';
import { truncateText } from '../utils/text';
import { formatRouteAddress } from '../utils/address';
import { shareEmail } from '../utils/email';
import { sortByLastName } from '../utils/sort';
import { useFocusEffect } from '@react-navigation/native';
import ThemedButton from '../components/Button';
import { createAllServiceRoutesScreen } from '../../../shared/screens/AllServiceRoutesScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'AllServiceRoutes'>;

const Screen = createAllServiceRoutesScreen({
  useAuth,
  adminAssignServiceRoute,
  adminFetchClients,
  adminFetchServiceRoutes,
  adminFetchUsers,
  showBanner,
  truncateText,
  formatRouteAddress,
  shareEmail,
  sortByLastName,
  useFocusEffect,
  ThemedButton,
  HeaderEmailChip,
  colors,
  spacing,
});

export default function AllServiceRoutesScreen({ navigation }: Props) {
  return <Screen navigation={navigation} />;
}
