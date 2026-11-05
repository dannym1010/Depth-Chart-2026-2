// The version at the top of the app: the commit it was built from and when (set by vite.config.ts).
declare const __APP_COMMIT__: string | undefined;
declare const __APP_BUILT_AT__: string | undefined;

export const APP_COMMIT: string = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev';
export const APP_BUILT: Date = new Date(typeof __APP_BUILT_AT__ !== 'undefined' ? __APP_BUILT_AT__ : Date.now());
