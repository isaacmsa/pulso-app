import AsyncStorage from '@react-native-async-storage/async-storage';

// El servidor solo entrega el código al crear la casa y al regenerarlo, así que el teléfono lo recuerda para poder
// compartirlo. No es un secreto de sesión (regla 3 no aplica: es lo que se manda por WhatsApp) y "Borrar mis datos"
// lo limpia.
export const SHARE_CODE_KEY = 'pulso-share-code';

// El último código que se supo, en memoria: si el disco falla, la pantalla no muestra otra cosa.
let known: string | null = null;

export async function readShareCode(): Promise<string | null> {
  if (known !== null) return known;
  try {
    return await AsyncStorage.getItem(SHARE_CODE_KEY);
  } catch {
    return null;
  }
}

/** Recuerda el código vigente. Nunca lanza: guardarlo es una comodidad y no debe tumbar el registro ni el regenerar. */
export async function saveShareCode(code: string): Promise<void> {
  known = code;
  try {
    await AsyncStorage.setItem(SHARE_CODE_KEY, code);
  } catch {
    // Queda en memoria hasta cerrar la app.
  }
}

export async function clearShareCode(): Promise<void> {
  known = null;
  try {
    await AsyncStorage.removeItem(SHARE_CODE_KEY);
  } catch {
    // Nada que limpiar si el disco falla.
  }
}
