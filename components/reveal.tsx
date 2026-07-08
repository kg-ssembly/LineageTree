import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

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
  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }

  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
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
  }, [delay, distance, duration, translateY]);

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
