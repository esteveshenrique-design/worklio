export type Theme={accent:string;secondary:string;background:string;surface:string;text:string;border:string;link:string};
export const defaultTheme:Theme;
export function validTheme(theme:unknown):boolean;
export function themeKey(theme:Theme|undefined):string;
