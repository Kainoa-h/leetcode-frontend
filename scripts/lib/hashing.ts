import {createHash} from 'node:crypto';
export function hash(value:string|object){return createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')}
