// Node.js 参照実装。秘密鍵は加盟店サーバー内だけで保持する。
import {createHash, sign} from 'node:crypto';
const sha256 = bytes => createHash('sha256').update(bytes).digest();
export function canonicalRequest({method,originalUrl,rawBody,timestamp,nonce}) {
  if (!Buffer.isBuffer(rawBody) && !(rawBody instanceof Uint8Array)) throw new TypeError('rawBody must be exact transmitted bytes');
  return [method,originalUrl,sha256(rawBody).toString('hex'),String(timestamp),nonce].join('\n');
}
export function signRequest({privateKey,...request}) {
  // sign('sha256') がハッシュするため、正準文字列を事前ハッシュしない。
  return sign('sha256',Buffer.from(canonicalRequest(request)),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('hex');
}
export function signChallenge({privateKey,challenge,rpId}) {
  // prepare 応答の 0x hex32 を WebAuthn の base64url へ変換する。
  if (!/^0x[0-9a-fA-F]{64}$/.test(challenge)) throw new TypeError('challenge must be hex32');
  const encodedChallenge=Buffer.from(challenge.slice(2),'hex').toString('base64url');
  const authenticatorData=Buffer.concat([sha256(Buffer.from(rpId)),Buffer.from([1,0,0,0,0])]);
  const clientDataJSON=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:encodedChallenge,origin:'stbl-pay:machine',crossOrigin:false}));
  const bytes=Buffer.concat([authenticatorData,sha256(clientDataJSON)]);
  return {authenticatorData:authenticatorData.toString('base64url'),clientDataJSON:clientDataJSON.toString('base64url'),signature:sign('sha256',bytes,{key:privateKey,dsaEncoding:'der'}).toString('base64url')};
}
