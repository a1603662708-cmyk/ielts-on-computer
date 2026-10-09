import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,use:{...base.use,baseURL:process.env.QA_BASE_URL||base.use?.baseURL},webServer:undefined,outputDir:'../work/qa/extra-results',reporter:[['list']]});
