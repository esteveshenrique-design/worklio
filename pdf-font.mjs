import {readFileSync} from 'node:fs';
import {PDFFont,PDFHexString,StandardFontEmbedder,StandardFonts} from './vendor/pdf-lib.mjs';
// Embed the complete licensed TrueType font with explicit glyph metrics and Unicode mapping.
export function embedFont(doc,name){
 const info=JSON.parse(readFileSync(new URL(`./vendor/${name}.json`,import.meta.url),'utf8')),bytes=readFileSync(new URL(`./vendor/${name}.ttf`,import.meta.url)),ctx=doc.context,scale=1000/info.units;
 const fontFile=ctx.register(ctx.flateStream(bytes,{Length1:bytes.length}));
 const descriptor=ctx.register(ctx.obj({Type:'FontDescriptor',FontName:name,Flags:32,FontBBox:info.bbox.map(n=>n*scale),ItalicAngle:0,Ascent:info.ascent*scale,Descent:info.descent*scale,CapHeight:info.ascent*scale,StemV:80,FontFile2:fontFile}));
 const cid=ctx.register(ctx.obj({Type:'Font',Subtype:'CIDFontType2',BaseFont:name,CIDSystemInfo:{Registry:PDFHexString.fromText('Adobe'),Ordering:PDFHexString.fromText('Identity'),Supplement:0},FontDescriptor:descriptor,CIDToGIDMap:'Identity',DW:1000,W:[0,info.widths.map(n=>n*scale)]}));
 const seen=new Set(),mapping=[];for(const [code,gid] of Object.entries(info.map)){if(seen.has(gid))continue;seen.add(gid);const unicode=Number(code);if(unicode>65535)continue;mapping.push(`<${gid.toString(16).padStart(4,'0')}> <${unicode.toString(16).padStart(4,'0')}>`);}
 let cmap='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';for(let i=0;i<mapping.length;i+=100){const batch=mapping.slice(i,i+100);cmap+=`${batch.length} beginbfchar\n${batch.join('\n')}\nendbfchar\n`;}cmap+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
 const unicode=ctx.register(ctx.flateStream(Buffer.from(cmap))),ref=ctx.register(ctx.obj({Type:'Font',Subtype:'Type0',BaseFont:name,Encoding:'Identity-H',DescendantFonts:[cid],ToUnicode:unicode}));
 const glyph=c=>{const g=info.map[c.codePointAt(0)];if(g===undefined)throw Error('Unsupported character');return g;};
 const embedder=Object.assign(StandardFontEmbedder.for(StandardFonts.Helvetica),{fontName:name,customName:name,encodeText:text=>PDFHexString.of(Array.from(text).map(c=>glyph(c).toString(16).padStart(4,'0')).join('')),widthOfTextAtSize:(text,size)=>Array.from(text).reduce((sum,c)=>sum+info.widths[glyph(c)],0)/info.units*size,heightOfFontAtSize:(size)=>((info.ascent-info.descent)/info.units)*size,sizeOfFontAtHeight:height=>height*info.units/(info.ascent-info.descent),embedIntoContext:async()=>ref});
 return PDFFont.of(ref,doc,embedder);
}
