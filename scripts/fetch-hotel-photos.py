#!/usr/bin/env python3
"""Exact-title Wikipedia/Commons property photographs, free licenses only.
No keyword-stock images, fuzzy identity matches, or AI-generated property photos.
Unknown identities and missing licenses remain explicitly without a photo.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request,urllib.parse,json,math,time,re,hashlib
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache/hotel-photos';CACHE.mkdir(parents=True,exist_ok=True)
HEADERS={'User-Agent':'CardWiseHotelExplorer/1.0 (personal noncommercial project; public image attribution)'}
def get(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if p.exists():return json.loads(p.read_text())
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=25) as r:data=json.load(r)
   p.write_text(json.dumps(data));return data
  except Exception as e:
   if attempt: return {'error':str(e)}
   time.sleep(1)
def api(host,params):return get('https://'+host+'/w/api.php?'+urllib.parse.urlencode({'format':'json','formatversion':2,**params}))
def clean(s):return re.sub('<[^>]*>','',s or '').strip()
catalog=json.loads((ROOT/'src/data/hotels/workbook.generated.json').read_text());hotels=catalog['hotels']
batches=[hotels[i:i+40] for i in range(0,len(hotels),40)]
def batch(hs):
 data=api('en.wikipedia.org',{'action':'query','titles':'|'.join(h['name'] for h in hs),'redirects':1,'prop':'pageimages|coordinates|categories','piprop':'thumbnail|name','pilicense':'free','pithumbsize':1200,'pilimit':40,'cllimit':10,'colimit':'max'})
 q=data.get('query',{});aliases={x['from']:x['to'] for x in q.get('normalized',[])+q.get('redirects',[])}
 pages={p['title']:p for p in q.get('pages',[])};out=[]
 for h in hs:
  name=h['name'];seen=set()
  while name in aliases and name not in seen:seen.add(name);name=aliases[name]
  p=pages.get(name,{})
  if not p.get('thumbnail') or '/commons/' not in p['thumbnail']['source']:continue
  coords=p.get('coordinates',[]);hotel_category=any(re.search(r'hotel|resort',c['title'],re.I) for c in p.get('categories',[]))
  close=False
  if coords and h.get('coords'):
   lat,lng=h['coords'];c=coords[0]
   close=(lat-c['lat'])**2+((lng-c['lon'])*math.cos(math.radians(lat)))**2<.1**2
  if not close and not hotel_category:continue
  out.append((h['id'],p))
 return out
matches=[]
with ThreadPoolExecutor(max_workers=2) as pool:
 for i,out in enumerate(pool.map(batch,batches)):
  matches+=out
  if (i+1)%10==0:print(f'Photo identity batches: {i+1}/{len(batches)}; exact property images: {len(matches)}',flush=True)
files=list(dict.fromkeys(p['pageimage'] for _,p in matches));licenses={}
for i in range(0,len(files),40):
 data=api('commons.wikimedia.org',{'action':'query','titles':'|'.join('File:'+f for f in files[i:i+40]),'prop':'imageinfo','iiprop':'url|extmetadata'})
 for p in data.get('query',{}).get('pages',[]):
  info=(p.get('imageinfo') or [{}])[0];m=info.get('extmetadata',{})
  licenses[p['title'][5:]]={k:clean(m.get(k,{}).get('value')) for k in ['LicenseShortName','LicenseUrl','Artist','AttributionRequired','ObjectName']}
manifest={};errors=[]
for ident,p in matches:
 m=licenses.get(p['pageimage'],{});license=m.get('LicenseShortName','')
 if not re.search(r'CC BY|CC0|Public domain',license,re.I) or not m.get('LicenseUrl'):continue
 url=p['thumbnail']['source'].split('?')[0]
 manifest[ident]={'url':url,'article':'https://en.wikipedia.org/wiki/'+urllib.parse.quote(p['title'].replace(' ','_')),'filePage':'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(p['pageimage'].replace(' ','_')),'author':m['Artist'],'license':license,'licenseUrl':m['LicenseUrl'],'verifiedAt':'2026-11-26','method':'Exact article title/redirect with hotel category or matching coordinates; free Commons image'}
(ROOT/'src/data/hotels/photos.generated.json').write_text(json.dumps({'coverage':len(manifest),'totalHotels':len(hotels),'photos':manifest},ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Attributed free property photographs: {len(manifest)}/{len(hotels)}. Others remain explicitly unpictured.',flush=True)
