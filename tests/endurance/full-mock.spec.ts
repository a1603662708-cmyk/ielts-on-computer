import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('Real scheduler Full Mock at 10x wall clock: automatic L/R/W; closed-page recovery in each stage',async({page,context})=>{
 const start=Date.now();const evidence:unknown[]=[];
 // Test runner alone accelerates wall time. Production source has no QA flag.
 const epoch=Date.now();await context.addInitScript(({epoch})=>{const native=Date.now.bind(Date);Date.now=()=>epoch+(native()-epoch)*10;},{epoch});
 await page.goto('/?mode=mock');await page.getByRole('button',{name:'Choose test →'}).click();await page.getByRole('button',{name:'Full Mock: L → R → W'}).click();await page.getByRole('button',{name:'Start Fullscreen Mock'}).click();await expect(page.getByRole('heading',{name:'LISTENING · Part 1'})).toBeVisible();
 await page.getByLabel('Answer for question 1',{exact:true}).fill('Morgan');
 for(const stage of ['listening','reading','writing']){
  if(stage==='reading'){await expect(page.getByRole('heading',{name:'READING · Part 1'})).toBeVisible({timeout:230000});await page.getByLabel('Answer for question 1',{exact:true}).selectOption('iv');await page.locator('[data-w="0"]').dblclick();await page.getByRole('button',{name:'Highlight',exact:true}).click();await page.getByRole('button',{name:'New note',exact:true}).click();await page.getByPlaceholder('Write your notes here. They save automatically.').fill('Endurance recovery note');await page.getByRole('button',{name:'Hide notes'}).click();}
  if(stage==='writing'){await expect(page.getByLabel('Task 1 answer')).toBeVisible({timeout:380000});await page.getByLabel('Task 1 answer').fill('Endurance writing retained across closed page.');}
  const key=stage==='writing'?'work.session':'ielts.session';
  evidence.push(await page.evaluate(key=>JSON.parse(localStorage.getItem('ielts.journal.'+key)!),key));
  await page.close();page=await context.newPage();await page.goto('/mock');
  if(stage==='listening')await expect(page.getByLabel('Answer for question 1',{exact:true})).toHaveValue('Morgan');
  if(stage==='reading'){await expect(page.getByLabel('Answer for question 1',{exact:true})).toHaveValue('iv');await expect(page.locator('[data-w="0"]')).toHaveClass(/w-hl/);}
  if(stage==='writing')await expect(page.getByLabel('Task 1 answer')).toHaveValue('Endurance writing retained across closed page.');
  console.log('Recovered stage',stage,'at real seconds',Math.round((Date.now()-start)/1000));
 }
 await expect(page.getByRole('heading',{name:'Exam history'})).toBeVisible({timeout:380000});await expect(page.locator('tbody tr')).toHaveCount(3);evidence.push({realSeconds:(Date.now()-start)/1000,rows:await page.locator('tbody tr').allTextContents()});fs.writeFileSync('../outputs/qa-evidence/full-mock-endurance.json',JSON.stringify(evidence,null,2));
});
