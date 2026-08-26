/** Haptics are a native-only nicety; under jsdom they are a no-op. */
export const selectionAsync = async (): Promise<void> => {};
export const impactAsync = async (): Promise<void> => {};
export const notificationAsync = async (): Promise<void> => {};
