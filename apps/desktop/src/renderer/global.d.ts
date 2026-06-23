export {};

declare global {
  interface Window {
    asahi: {
      getApiBaseURL(): Promise<string>;
    };
  }
}
