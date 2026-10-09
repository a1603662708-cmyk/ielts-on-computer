import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
reading=json.loads((root/'public/samples/demo-reading.questions.json').read_text())
key=json.loads((root/'public/samples/demo-reading.answers.json').read_text())
reading['durationSeconds']=3600
reading['title']='Original demonstration — Academic Reading'
sets=[('A community seed library',[
('The project began in which month?','March'),('Where are the seed drawers kept?','library'),('Which colour identifies vegetable packets?','green'),('How many packets can each visitor borrow?','three'),('What must members record before sowing?','date'),('Who teaches the monthly workshops?','volunteers'),('Which crop was the most popular?','beans'),('What protects seedlings from birds?','netting'),('Which material is used for labels?','wood'),('How often are stock levels checked?','weekly'),('What do members return after harvesting?','seeds'),('Which room hosts the workshops?','annex'),('What is the annual membership cost?','free'),('Which season is the busiest?','spring')],
'The community seed library opened in March. Its seed drawers are kept in the public library. Green packets contain vegetables, while blue packets contain flowers. Visitors may borrow three packets at a time. Members record the sowing date in a shared notebook. Volunteers teach monthly workshops in the annex. Beans have proved the most popular crop. Gardeners use netting to protect young plants from birds and wood to make reusable labels. Staff check stock weekly. After the harvest, members return seeds from healthy plants. Membership is free and spring is the busiest season.'),
('A coastal research station',[
('In what year did the station open?','2014'),('Which material forms its outer walls?','timber'),('Which direction do its largest windows face?','south'),('What generates most of its electricity?','solar panels'),('What stores surplus electricity?','batteries'),('How many permanent researchers work there?','six'),('Which animals are monitored each morning?','seabirds'),('What measures the water temperature?','sensors'),('How often is the water sampled?','daily'),('What carries samples to the mainland?','ferry'),('Which room is kept at a constant temperature?','laboratory'),('What may school groups use to view specimens?','microscopes'),('Which month is reserved for maintenance?','November'),('What is the principal research topic?','climate')],
'The coastal research station opened in 2014. Its outer walls are timber. Large windows face south. Solar panels generate most of the electricity, and batteries store the surplus. Six permanent researchers live on site. Each morning they monitor seabirds on the cliffs. Sensors measure water temperature and staff collect water samples daily. A ferry carries these samples to the mainland. The laboratory is kept at a constant temperature. Visiting school groups may use microscopes to examine specimens. November is reserved for maintenance, so the station is closed to visitors. Climate is the principal research topic.')]
n=13
for i,(title,items,text) in enumerate(sets,2):
 groups=[{'type':'gap','questionType':'short-answer','limit':'NO MORE THAN TWO WORDS AND/OR A NUMBER','questions':[]}]
 for prompt,answer in items:
  groups[0]['questions'].append({'n':n,'prompt':prompt});key['answers'][str(n)]=answer;n+=1
 reading['parts'].append({'part':i,'passage':{'title':title,'paragraphs':[{'text':text}]},'groups':groups})
listening={'formatVersion':1,'title':'Original demonstration — Listening','type':'listening','durationSeconds':1920,'instructions':'Original short demonstration recordings. This is a functional demo, not a full-length IELTS paper. Write ONE WORD AND/OR A NUMBER.','audio':[],'parts':[]}
lkey={'formatVersion':1,'answers':{}}
data=[('Visitor booking',[('Family name','Morgan'),('Number of guests','four'),('Arrival month','June'),('Room type','twin'),('Nights requested','three'),('Breakfast time','eight'),('Transport','train'),('Dietary requirement','vegetarian'),('Deposit amount','fifty'),('Booking reference','6382')]),('Museum visit',[('Opening time','nine'),('Closing time','five'),('Closed day','Monday'),('Adult ticket price','twelve'),('Student ticket price','eight'),('Main exhibition theme','oceans'),('Cafe location','upstairs'),('Meeting point','entrance'),('Tour length in minutes','forty'),('Guide name','Alice')]),('Student project',[('Project topic','recycling'),('Team size','three'),('Survey location','campus'),('Participants needed','sixty'),('Deadline month','October'),('Presentation length in minutes','ten'),('Data format','spreadsheet'),('Supervisor name','Patel'),('Equipment needed','recorder'),('Meeting day','Thursday')]),('Urban gardens',[('Research city','Bristol'),('Study duration in years','two'),('Number of gardens','fifteen'),('Most common crop','tomatoes'),('Main benefit','exercise'),('Main difficulty','water'),('Preferred soil treatment','compost'),('Volunteer meeting day','Saturday'),('Recommended container material','wood'),('Final report month','December')])]
n=1
for part,(title,items) in enumerate(data,1):
 lines=[f'Part {part}. {title}. This is an original demonstration recording. Listen and complete the notes.']
 questions=[];body=[]
 for label,answer in items:
  questions.append({'n':n});body.append(f'{label}: {{{{{n}}}}}');lkey['answers'][str(n)]=answer;lines.append(f'{label}: {answer}.');n+=1
 lines.append('That is the end of this part.')
 (root/f'public/demo/part{part}.txt').write_text('\n'.join(lines))
 listening['audio'].append({'part':part,'url':f'/demo/part{part}.m4a'})
 listening['parts'].append({'part':part,'heading':title,'groups':[{'type':'gap','questionType':'note-completion','intro':title,'limit':'ONE WORD AND/OR A NUMBER','body':{'kind':'text','lines':body},'questions':questions}]})
writing={'title':'Original Academic Writing demonstration','durationSeconds':3600,'tasks':[{'prompt':'The chart shows the percentage of residents using three forms of transport in a fictional town in 2010 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.','image':'/demo/transport.svg','minWords':150},{'prompt':'Some people believe that public libraries should focus on digital resources, while others think printed books should remain their priority. Discuss both views and give your own opinion.','minWords':250}]}
speaking={'title':'Original Speaking practice','part1':['Where do you live?','What do you enjoy about your neighbourhood?','How do you usually spend your weekends?','Do you prefer reading printed books or digital books?','What skill would you like to learn?'],'cueCard':'Describe a place you enjoyed visiting.\n\nYou should say:\n• where it is\n• when you visited\n• what you did there\n\nand explain why you enjoyed visiting this place.','part3':['Why do people enjoy visiting unfamiliar places?','How can tourism benefit local communities?','What problems can large numbers of visitors cause?','How might travel change in the future?']}
entry={'formatVersion':2,'id':'original-demo','book':'Original Demo','test':1,'module':'Academic','title':'A complete interface demonstration','createdAt':1791532800000,'sections':{'reading':{'paper':reading,'key':key},'listening':{'paper':listening,'key':lkey},'writing':writing,'speaking':speaking}}
(root/'public/demo/metadata.json').write_text(json.dumps(entry,indent=2))
(root/'library/Original-Demo/Test-1/metadata.json').write_text(json.dumps(entry,indent=2))
for section,value in entry['sections'].items():
 (root/f'library/Original-Demo/Test-1/{section}/section.json').write_text(json.dumps(value,indent=2))
