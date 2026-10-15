import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickOutcome {
  uris: string[];
  /** 'denied' → permission refused; undefined → picked or simply cancelled. */
  error?: 'denied';
}

const MAX_SIDE = 900;

/** Web only: shrink to <= 900px JPEG so photos fit in browser storage. */
const downscaleWeb = (uri: string): Promise<string> =>
  new Promise(resolve => {
    try {
      const img = new (globalThis as any).Image();
      img.onload = () => {
        const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    } catch {
      resolve(uri);
    }
  });

/**
 * Opens the photo library. Returns data-URI strings so images can be stored with the post
 * (AsyncStorage) until real cloud storage (Supabase) is connected.
 */
export const pickImages = async (opts: { multiple?: boolean; max?: number; square?: boolean } = {}): Promise<PickOutcome> => {
  const { multiple = false, max = 1, square = false } = opts;

  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { uris: [], error: 'denied' };
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? max : 1,
    allowsEditing: square && !multiple,
    aspect: square ? [1, 1] : undefined,
    quality: 0.6,
    base64: Platform.OS !== 'web',
  });
  if (res.canceled) return { uris: [] };

  const uris = await Promise.all(
    res.assets.slice(0, max).map(async a => {
      if (Platform.OS === 'web') return downscaleWeb(a.uri);
      return a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
    })
  );
  return { uris };
};
