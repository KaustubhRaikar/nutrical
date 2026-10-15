import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { calculateProgress } from '../lib/targets';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  consumed: number;
  target: number;
  size?: number;
  strokeWidth?: number;
}

export default function ProgressRing({
  consumed,
  target,
  size = 190,
  strokeWidth = 14,
}: ProgressRingProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  const { percentage, remaining, isOver, clampedPercentage } = calculateProgress(consumed, target);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * clampedPercentage) / 100;

  const animatedOffset = useRef(new Animated.Value(circumference)).current;

  // Check OS reduced motion accessibility preference
  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  // Animate progress circle stroke
  useEffect(() => {
    if (reduceMotion) {
      animatedOffset.setValue(strokeDashoffset);
    } else {
      Animated.timing(animatedOffset, {
        toValue: strokeDashoffset,
        duration: 750,
        useNativeDriver: true,
      }).start();
    }
  }, [strokeDashoffset, reduceMotion, animatedOffset]);

  const accessibleLabel = `${consumed.toLocaleString()} of ${target.toLocaleString()} calories, ${
    isOver ? `${Math.abs(remaining).toLocaleString()} calories over target` : `${remaining.toLocaleString()} calories remaining`
  }`;

  const ringColor = isOver ? '#FF5252' : 'url(#ringGradient)';
  const centerValueColor = isOver ? '#FF6B6B' : '#FFFFFF';

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibleLabel}
      accessibilityValue={{
        min: 0,
        max: target,
        now: Math.min(consumed, target),
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ECDC4" />
            <Stop offset="100%" stopColor="#0d5ef5" />
          </SvgGradient>
        </Defs>

        {/* Background track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress indicator circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center Label Overlay */}
      <View style={styles.centerContainer}>
        <Text style={[styles.remainingValue, { color: centerValueColor }]}>
          {Math.abs(remaining).toLocaleString()}
        </Text>
        <Text style={[styles.remainingLabel, isOver && styles.dangerLabel]}>
          {isOver ? 'kcal over' : 'kcal remaining'}
        </Text>
        <View style={[styles.progressPill, isOver && styles.dangerProgressPill]}>
          <Text style={styles.progressPillText}>{percentage}%</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  remainingValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  remainingLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  dangerLabel: {
    color: '#FF6B6B',
  },
  progressPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  dangerProgressPill: {
    backgroundColor: 'rgba(255, 82, 82, 0.25)',
  },
  progressPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
