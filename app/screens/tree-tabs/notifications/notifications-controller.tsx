import { useNavigation } from '@react-navigation/native';
import type { MainTabParamList } from '../../../../components/dto/navigation';
import type { SharedTabProps } from '../shared';
import { NotificationsView } from './notifications-view';

export function NotificationsController(props: SharedTabProps) {
  const navigation = useNavigation<any>();

  return (
    <NotificationsView
      {...props}
      navigation={{
        navigate: (name: keyof MainTabParamList) => navigation.navigate(name),
      }}
    />
  );
}
