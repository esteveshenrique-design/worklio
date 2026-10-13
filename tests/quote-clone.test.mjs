import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloneQuote,nextQuoteNumber} from '../.test-render/components/quoteClone.mjs';
test('cloning a paid quote creates an independent draft retaining subject groups and mixed VAT',()=>{
 const source={id:'old',number:'QT-009',customer:'c1',title:'Renovation',date:'2026-01-02',status:'Paid',tax:23,groups:[{id:'g1',name:'Painting'}],lines:[{description:'Paint',qty:2,price:80,vat:6,groupId:'g1'},{description:'Labour',qty:1,price:50,vat:23}]};
 const original=structuredClone(source);const result=cloneQuote(source,[source,{number:'QT-015'}],'new','2026-10-03');
 assert.equal(result.number,'QT-016');assert.equal(result.id,'new');assert.equal(result.date,'2026-10-03');assert.equal(result.status,'Draft');assert.equal(result.customer,source.customer);assert.equal(result.title,source.title);assert.deepEqual(result.lines,source.lines);assert.deepEqual(result.groups,source.groups);
 result.lines[0].price=5;result.groups[0].name='Electricity';assert.deepEqual(source,original);
});
test('quote numbering handles gaps and legacy quotes without groups',()=>{assert.equal(nextQuoteNumber([]),'QT-001');assert.equal(nextQuoteNumber([{number:'QT-003'},{number:'QT-001'},{number:'CUSTOM'}]),'QT-004');const source={id:'old',number:'QT-001',status:'Accepted',date:'2025-01-01',customer:'c',title:'Repair',tax:23,lines:[{description:'Labour',qty:1,price:20}]};const result=cloneQuote(source,[source],'new','2026-10-03');assert.equal(result.tax,23);assert.equal(result.lines[0].vat,undefined);assert.equal(result.groups,undefined);assert.equal(result.status,'Draft');});
