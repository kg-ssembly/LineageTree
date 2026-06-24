import React from 'react';
import TreeDetailView from './tree-detail-view';

export default function TreeDetailController(props: React.ComponentProps<typeof TreeDetailView>) {
  return <TreeDetailView {...props} />;
}
