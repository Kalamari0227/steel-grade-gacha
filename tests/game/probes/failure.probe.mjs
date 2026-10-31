import {test,expect} from '@playwright/test';
test('a misleading PASS line cannot override actual assertion failure',()=>{console.log('PASS');expect(1).toBe(2);});
