export type Language='en'|'pt'|'fr'|'es';
export const languages:{code:Language,label:string,locale:string}[];
export const dictionaries:Record<Language,Record<string,string>>;
export function translate(language:Language,key:string):string;
export function selectLanguage(saved:string|null,browser?:string):Language;
