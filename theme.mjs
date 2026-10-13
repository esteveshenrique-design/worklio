export const defaultTheme={accent:'#ff9966',secondary:'#ffcc99',background:'#f5f5f5',surface:'#ffffff',text:'#202020',border:'#c0c0c0',link:'#0066cc'};
export function validTheme(theme){return theme===undefined||(theme&&typeof theme==='object'&&!Array.isArray(theme)&&Object.keys(theme).length===Object.keys(defaultTheme).length&&Object.keys(defaultTheme).every(k=>typeof theme[k]==='string'&&/^#[0-9a-f]{6}$/i.test(theme[k])));}
export const themeKey=theme=>JSON.stringify(Object.keys(defaultTheme).map(k=>(theme||defaultTheme)[k]?.toLowerCase()));
