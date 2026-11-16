import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {diffSpecs} from './openapi-parity.mjs';
const yaml=createRequire(new URL('../docs-site/package.json',import.meta.url))('js-yaml');
const source=JSON.parse(readFileSync(new URL('./fixtures/merchant-openapi-0.35.0.json',import.meta.url)));
const ja=yaml.load(readFileSync('docs-site/static/openapi.yaml','utf8'));
const en=yaml.load(readFileSync('docs-site/i18n/en/openapi.yaml','utf8'));
test('Japanese and English specification parity',()=>assert.deepEqual(diffSpecs(ja,en),[]));
test('all machine paths and schemas match backend generated export',()=>{
 let count=0;
 for(const [path,methods] of Object.entries(source.paths))for(const [method,op] of Object.entries(methods))if(op['x-auth-scheme']==='machine-signature'){
 count++;
 const actual=structuredClone(ja.paths[path][method]);delete actual.operationId;
 assert.deepEqual(actual,op);
 }
 assert.equal(count,6);
});

test('webhook union is generated from the shared schema',()=>{
 assert.deepEqual(ja.components.schemas.WebhookEventPayload,source.components.schemas.WebhookEventPayload);
 assert.equal(ja.webhooks.paymentEvent.post.requestBody.content['application/json'].schema.oneOf[0].$ref,'#/components/schemas/WebhookEventPayload');
 const union=source.components.schemas.WebhookEventPayload.oneOf;
 assert.equal(union.length,6);
 assert.deepEqual(union.slice(-2).map(v=>v.properties.type.const),['refund.confirmed','refund.failed']);
});


test('authenticated lookup exposes twelve fields and retryable failures',()=>{
 const op=ja.paths['/payments/{paymentIntentId}']?.get;
 assert.ok(op,'authenticated lookup path must exist');
 assert.equal(op['x-auth-scheme'],'api-key');
 assert.ok(op.parameters.some(p=>p.name==='x-stbl-api-key' && p.in==='header' && p.required));
 const schema=op.responses['200'].content['application/json'].schema;
 assert.equal(Object.keys(schema.properties).length,12);
 assert.equal(schema.required.length,12);
 for(const key of ['orderId','txHash','settledAt','failedReason','payerAddress','netAmountDestination']) assert.ok(JSON.stringify(schema.properties[key]).includes('null'),key);
 assert.equal(op.responses['429'].headers['Retry-After'].schema.type,'integer');
 assert.equal(op.responses['429'].headers['Retry-After'].schema.minimum,1);
 assert.ok(op.responses['503']);
});


test('lookup matches backend export and preserves refund event definitions',()=>{
 const op=structuredClone(ja.paths['/payments/{paymentIntentId}'].get);delete op.operationId;
 assert.deepEqual(op,source.paths['/payments/{paymentIntentId}'].get);
 const previous=JSON.parse(readFileSync(new URL('./fixtures/merchant-openapi-0.32.0.json',import.meta.url)));
 const union=ja.components.schemas.WebhookEventPayload.oneOf;
 assert.deepEqual(union.slice(-2),previous.components.schemas.WebhookEventPayload.oneOf.slice(-2));
 for(const event of union.slice(0,4)) {
  const data=event.properties.data;
  for(const key of ['payer_address','net_amount_destination']) {
   assert.ok(data.properties[key]);assert.ok(!data.required.includes(key));
   assert.ok(JSON.stringify(data.properties[key]).includes('null'));
  }
 }
});

test('test notification examples expose approved fixed addresses',()=>{
 for(const spec of [ja,en]) {
  const request=spec.webhooks.paymentEvent.post.requestBody.content['application/json'];
  assert.equal(request.examples.test.value.data.payer_address,'0x1111111111111111111111111111111111111111');
  assert.equal(request.examples.test.value.data.net_amount_destination,'0x2222222222222222222222222222222222222222');
  for(const key of ['payer_address','net_amount_destination']) {
   assert.ok(spec.components.schemas.TestWebhookEvent.properties.data.required.includes(key));
  }
 }
});
