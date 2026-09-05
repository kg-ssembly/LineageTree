import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Reveal({
  children,
  delay = 0,
  distance = 18,
  duration = 360,
  style,
}: RevealProps) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion || Platform.OS === 'web') {
      translateY.setValue(0);
      return;
    }
    translateY.setValue(distance);

    const animation = Animated.timing(translateY, {
      toValue: 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [delay, distance, duration, reduceMotion, translateY]);

  if (Platform.OS === 'web') return <View style={style}>{children}</View>;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
