import { useRef, type ComponentRef, type RefObject } from 'react';
import { Pressable, View } from 'react-native';

export type ViewRef = ComponentRef<typeof View>;
export type PressableRef = ComponentRef<typeof Pressable>;

export function useViewRef(): RefObject<ViewRef | null> {
  return useRef<ViewRef | null>(null);
}

export function usePressableRef(): RefObject<PressableRef | null> {
  return useRef<PressableRef | null>(null);
}

type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export function measureInWindow(
  node: Measurable | null | undefined,
  callback: (x: number, y: number, width: number, height: number) => void,
): void {
  node?.measureInWindow(callback);
}
