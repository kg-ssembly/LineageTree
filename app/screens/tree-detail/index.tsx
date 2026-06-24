import React from 'react';
import TreeDetailController from './tree-detail-controller';

export default function TreeDetailScreen(props: React.ComponentProps<typeof TreeDetailController>) {
  return <TreeDetailController {...props} />;
}
