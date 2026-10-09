import json,copy
from pathlib import Path
r=Path(__file__).resolve().parents[1]
x=json.loads((r/'public/demo/metadata.json').read_text());x.update(id='qa-original-40',book='QA Original Full Scale',title='Original 40-question functional acceptance paper')
# Same original factual sources, expanded into the common IELTS interaction forms.
rd=x['sections']['reading'];p=rd['paper']['parts'][1];p['groups']=[]
k=rd['key']['answers']
forms=['matching-headings','matching-information','matching-features','matching-sentence-endings','sentence-completion','summary-completion','note-completion','table-completion','flow-chart-completion','diagram-label-completion','short-answer','yes-no-not-given','true-false-not-given','multiple-choice']
for n,f in enumerate(forms,13):
 answer=k[str(n)];g={'type':'gap','questionType':f,'limit':'NO MORE THAN TWO WORDS','questions':[{'n':n,'prompt':f'Complete the information from the seed library passage: item {n}.'}]}
 if f.startswith('matching'):
  g.update(type='matching',options=[{'key':'A','text':answer},{'key':'B','text':'A private concert hall'},{'key':'C','text':'A marine laboratory'}]);k[str(n)]='A'
 elif f in ['yes-no-not-given','true-false-not-given']:
  g.update(type='yn-ng' if f.startswith('yes') else 'tf-ng');g['questions'][0]['prompt']='The library membership is free.';k[str(n)]='YES' if f.startswith('yes') else 'TRUE'
 elif f=='multiple-choice':
  g.update(type='mcq');g['questions'][0].update(prompt='Which season is the busiest?',options=['spring','winter','autumn']);k[str(n)]='A'
 if f in ['table-completion','flow-chart-completion','note-completion','summary-completion']:
  g['questions']=[{'n':n}]
  content=f'Complete the original detail: {{{{{n}}}}}'
  g['body']={'kind':'table','headers':['Detail','Answer'],'rows':[['Library fact',f'{{{{{n}}}}}']]} if f=='table-completion' else {'kind':'flow','steps':['Read the seed packet',content,'Return healthy seeds']} if f=='flow-chart-completion' else {'kind':'notes','items':[{'text':content,'indent':0}]} if f=='note-completion' else {'kind':'text','lines':[content]}
 if f=='diagram-label-completion':g.update(image='/demo/transport.svg',imageAlt='Original diagram used to test image and label positioning')
 p['groups'].append(g)
# Preserve realistic-sized scrolling without borrowing any published material.
for i,part in enumerate(rd['paper']['parts']):
 source=part['passage']['paragraphs'][-1]['text']
 for j in range(7):
  part['passage']['paragraphs'].append({'label':f'QA-{j+1}','text':f'Field note {j+1}. The following is an independent observation from the original research project. '+source+' Researchers distinguish measured facts from proposals. Their weekly meetings compare records from different sites, identify incomplete entries and agree on the next collection schedule. Local participants can question the interpretation before the report is finalised.'})
li=x['sections']['listening'];p=li['paper']['parts'][1];answers=li['key']['answers'];p['groups']=[]
for n in range(11,21):
 a=answers[str(n)];g={'type':'gap','questionType':'sentence-completion','questions':[{'n':n,'prompt':f'Museum detail {n}: complete the missing information.'}]}
 if n in [11,12]:g.update(type='mcq',questionType='multiple-choice');g['questions'][0]['options']=[a,'midnight','seven'];answers[str(n)]='A'
 if n in [13,14]:g.update(type='matching',questionType='matching',options=[{'key':'A','text':a},{'key':'B','text':'Sunday'}]);answers[str(n)]='A'
 if n in [15,16]:g.update(questionType='diagram-label-completion',image='/demo/transport.svg',imageAlt='Original QA visual')
 if n in [17,18]:g.update(questionType='table-completion',questions=[{'n':n}],body={'kind':'table','headers':['Museum fact','Value'],'rows':[['Complete',f'{{{{{n}}}}}']]})
 p['groups'].append(g)
p=li['paper']['parts'][2];old=p['groups'][0];old['questions']=old['questions'][2:];old['body']['lines']=old['body']['lines'][2:]
p['groups'].insert(0,{'type':'mcq-multi','questionType':'multiple-choice-multi','range':[21,22],'pick':2,'prompt':'Choose two correct project details.','options':['The topic is recycling','The topic is astronomy','The team has three members','The team has ten members']});answers['21']='A';answers['22']='C'
x['sections']['speaking']['part1']+=['What kind of public transport do you use?','When do you usually read?','Would you like to learn another language?']
x['sections']['speaking']['part3']+=['How should public places be funded?']
(r/'tests/fixtures/rc-paper.json').write_text(json.dumps(x,indent=2))
(r.parent/'outputs/qa-evidence/original-full-scale-test.json').write_text(json.dumps(x,indent=2))
