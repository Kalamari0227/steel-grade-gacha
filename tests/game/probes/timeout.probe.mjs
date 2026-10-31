import {test} from '@playwright/test';
test('an unresolved operation terminates at the configured deadline',async()=>{test.setTimeout(500);await new Promise(()=>{});});
