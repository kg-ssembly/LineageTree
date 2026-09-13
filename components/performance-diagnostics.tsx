import React, { useState } from 'react';
import { Button, Text } from 'react-native-paper';
import { getPerformanceMetrics } from './performance-metrics';
import { SectionCard } from './ui';

/** Development-only diagnostics; no family information is collected or transmitted. */
export function PerformanceDiagnostics() {
  const [metrics, setMetrics] = useState<ReturnType<typeof getPerformanceMetrics>>([]);
  if (!__DEV__) return null;
  return <SectionCard>
    <Button onPress={() => setMetrics(getPerformanceMetrics())}>Refresh performance diagnostics</Button>
    {metrics.slice(-20).map((metric, index) => <Text key={index} selectable>{metric.name}: {metric.value.toFixed(1)}</Text>)}
  </SectionCard>;
}
