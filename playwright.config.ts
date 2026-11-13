import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const folder = mkdtempSync(join(tmpdir(), 'tamir-e2e-'));
export default defineConfig({testDir:'tests/e2e', workers:1, retries:0, use:{baseURL:'http://127.0.0.1:3125', browserName:'chromium',viewport:{width:1440,height:1000}}, webServer:{command:'npm start',url:'http://127.0.0.1:3125/api/health',reuseExistingServer:false,timeout:30000,env:{PORT:'3125',DATABASE_URL:`file:${join(folder,'browser.sqlite').replaceAll('\\','/')}`,SEED_DEMO:'true'}}, reporter:'list'});
