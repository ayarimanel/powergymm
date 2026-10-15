/**
 * How much of the screen the on-screen keyboard is covering, in pixels.
 *
 * Why not KeyboardAvoidingView: it only behaves on iOS ('padding'), does nothing
 * useful on Android without extra config, and nothing at all on web — which is
 * where this app is used most. A plain number works everywhere and can be added
 * to whatever padding a sheet or screen already has.
 *
 * On web there is no Keyboard event, so we use the visual viewport: when the
 * on-screen keyboard opens, the browser shrinks it rather than firing an event.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export const useKeyboardHeight = (): number => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? (window as any).visualViewport : undefined;
      if (!vv) return;
      const onResize = () => {
        // The gap between the layout viewport and the visible one is the keyboard.
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        // Small shifts are the browser's own chrome, not a keyboard.
        setHeight(covered > 120 ? covered : 0);
      };
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
      onResize();
      return () => {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      };
    }

    // iOS reports the frame before it animates; Android only once it is there.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, e => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
};
