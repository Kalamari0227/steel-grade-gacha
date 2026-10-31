import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decode} from '../../tools/game-assets/images.mjs';

test('repeated decoding completes after asynchronous reads of a 131460-byte WebP',async()=>{
  const evidence=path.resolve(process.env.DECODER_TEST_EVIDENCE||'.omo/evidence/decoder-input');
  await fs.mkdir(evidence,{recursive:true});
  const input=new URL('../../src/game/art/parts/sill.webp',import.meta.url);
  const record={input:input.pathname,inputSha256:null,inputBytes:null,completed:0,error:null};
  try {
    for(let iteration=0;iteration<200;iteration++) {
      const bytes=await fs.readFile(input);
      record.inputSha256=createHash('sha256').update(bytes).digest('hex');record.inputBytes=bytes.length;
      assert.ok(bytes.length>128*1024);
      const result=decode(bytes);
      assert.equal(result.width,768);assert.equal(result.height,768);
      assert.ok(result.visible>0);assert.ok(result.transparent>0);
      record.completed++;
    }
  } catch(error) {
    record.error={code:error.code,message:error.message};throw error;
  } finally {
    await fs.writeFile(path.join(evidence,'input-regression.json'),JSON.stringify(record,null,2)+'\n');
  }
});
