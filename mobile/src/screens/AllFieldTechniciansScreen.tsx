import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { adminFetchUsers, adminFetchServiceRoutes, adminClearRoutesForTech } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import ThemedButton from '../components/Button';
import HeaderEmailChip from '../components/HeaderEmailChip';
import { shareEmail } from '../utils/email';
import { sortByLastName } from '../utils/sort';
import { truncateText } from '../utils/text';
import { createAllFieldTechniciansScreen } from '../../../shared/screens/AllFieldTechniciansScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'AllFieldTechnicians'>;

const Screen = createAllFieldTechniciansScreen({
  useAuth,
  adminFetchUsers,
  adminFetchServiceRoutes,
  adminClearRoutesForTech,
  showBanner,
  truncateText,
  shareEmail,
  sortByLastName,
  useFocusEffect,
  ThemedButton,
  HeaderEmailChip,
  colors,
  spacing,
});

export default function AllFieldTechniciansScreen({ navigation }: Props) {
  return <Screen navigation={navigation} />;
}
