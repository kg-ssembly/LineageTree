import React from 'react';
import PersonProfileController from './person-profile-controller';

export default function PersonProfileScreen(props: React.ComponentProps<typeof PersonProfileController>) {
  return <PersonProfileController {...props} />;
}
