import React from 'react';
import PersonProfileView from './person-profile-view';

export default function PersonProfileController(props: React.ComponentProps<typeof PersonProfileView>) {
  return <PersonProfileView {...props} />;
}
