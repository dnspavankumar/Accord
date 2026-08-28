declare module 'next' {
  export interface Metadata {
    title?: string;
    description?: string;
    [key: string]: any;
  }
}

declare module 'next/font/google' {
  export interface FontOptions {
    subsets?: string[];
    variable?: string;
    display?: string;
    weight?: string | string[];
    style?: string | string[];
  }

  export interface FontConfig {
    className: string;
    variable: string;
    style: { fontFamily: string };
  }

  export function Inter(options?: FontOptions): FontConfig;
  export function JetBrains_Mono(options?: FontOptions): FontConfig;
  export function Space_Mono(options?: FontOptions): FontConfig;
}
