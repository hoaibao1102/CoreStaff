/** Only what src/config.ts needs at type level — scratch check runs in Node. */
declare module 'react-native' {
  export const Platform: { OS: string };
}
declare const __DEV__: boolean;
