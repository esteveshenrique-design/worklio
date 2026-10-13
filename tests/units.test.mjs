import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import UnitDropdown,{reusableUnits} from '../.test-render/components/components/UnitDropdown.mjs';
import QuoteEditor from '../.test-render/components/components/QuoteEditor.mjs';
import QuoteItems from '../.test-render/components/components/QuoteItems.mjs';
import {languages,translate} from '../src/translations.mjs';
const quote={id:'new',title:'Repair',number:'QT-1',date:'2026-10-03',status:'Draft',tax:23,customer:'c',lines:[{description:'Labour',qty:1,price:20}]};
test('unit options are empty without history and deduplicate historical and current item units',()=>{
 assert.deepEqual(reusableUnits([],quote),[]);
 const saved=[{...quote,id:'old',lines:[{...quote.lines[0],unit:' m² '},{...quote.lines[0],unit:'Hour'},{...quote.lines[0],unit:'hour'},{...quote.lines[0],unit:''}]}];
 const units=reusableUnits(saved,{...quote,lines:[{...quote.lines[0],unit:'m²'},{...quote.lines[0],unit:'kg'}]});
 assert.equal(units.length,3);assert.ok(units.includes('m²'));assert.ok(units.includes('Hour'));assert.ok(units.includes('kg'));
});
test('every language exposes an editable unit dropdown and displays the selected unit in preview',()=>{
 for(const {code} of languages){const t=key=>translate(code,key);const html=renderToString(createElement(UnitDropdown,{units:[],value:'',t,onSelect:()=>{}}));assert.ok(html.includes(`aria-label="${t('Unit of measure')}"`));assert.ok(html.includes('<datalist'));assert.ok(html.includes('type="text"'));assert.ok(!html.includes('<details'));assert.ok(!html.includes(t('Add unit')));assert.ok(!html.includes('m²'));
 const current={...quote,lines:[{...quote.lines[0],unit:'m²'}]};const editor=renderToString(createElement(QuoteEditor,{quotes:[{...quote,id:'old',lines:[{...quote.lines[0],unit:'hour'}]}],quote:current,setQuote:()=>{},customers:[],t,eur:String,busy:false,ready:true,onSave:async()=>{}}));assert.ok(editor.includes('hour'));assert.ok(editor.includes('m²'));const preview=renderToString(createElement(QuoteItems,{quote:current,t,eur:String}));assert.ok(preview.includes(t('Unit of measure')));assert.ok(preview.includes('<td>m²</td>'));}
});
