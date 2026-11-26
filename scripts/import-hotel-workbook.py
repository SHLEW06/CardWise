#!/usr/bin/env python3
"""Read the owner's workbook, preserving row provenance and unknown prices.
No workbook editing, network, price scraping, AI or synthetic hotel photos.
"""
import argparse, collections, hashlib, json, re, unicodedata, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
DEFAULT=ROOT/'docs/data/hotel-workbook/Edit + FHR + Hotel Collection hotels under $350.xlsx'
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def key(text):
    return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFKD',str(text)).encode('ascii','ignore').decode().lower()).strip()
def number(x):
    try:return float(x) if '.' in str(x) else int(x)
    except (ValueError,TypeError):return None
def load(path):
    with zipfile.ZipFile(path) as z:
        shared=[''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
        def sheet(i):
            rows=[]
            for row in ET.fromstring(z.read(f'xl/worksheets/sheet{i}.xml')).findall('s:sheetData/s:row',NS):
                values={}
                for c in row:
                    v=c.find('s:v',NS); inline=c.find('s:is',NS)
                    val=v.text if v is not None else ''.join(inline.itertext()) if inline is not None else ''
                    values[re.sub(r'\d','',c.get('r'))]=shared[int(val)] if c.get('t')=='s' else val
                rows.append((int(row.get('r')),values))
            return rows
        return {i:sheet(i) for i in range(1,5)}
def build(path):
    sheets=load(path);props={};conflicts=[]
    # Optional existing owner export supplies coordinates only, after exact
    # name/city/country matching. Its prices never overwrite the workbook.
    coordinate_path=ROOT/'cardwise-hotels.json'
    coordinates={}
    if coordinate_path.exists():
        for h in json.loads(coordinate_path.read_text()).get('hotels',[]):
            identity=tuple(key(h.get(k,'')) for k in ['name','city','country'])
            if h.get('lat') is not None and h.get('lng') is not None:coordinates[identity]=[h['lat'],h['lng']]
    for i in [2,3]:
        label='All priced hotels' if i==2 else 'Not priced'
        for row,r in sheets[i][1:]:
            if not r.get('A'):continue
            identity=tuple(unicodedata.normalize('NFC',r.get(k,'')).strip() for k in ['A','B','C'])
            ident='stay-'+hashlib.sha256('\x1f'.join(identity).encode()).hexdigest()[:14]
            h=props.setdefault(identity,{'id':ident,'name':r['A'],'city':r.get('B',''),'country':r.get('C',''),'region':None,'brand':None,'programs':[], 'averageNightly':None,'lowestSeen':None,'priceRange':None,'observations':[],'sourceRows':[],'coords':coordinates.get(tuple(key(x) for x in identity))})
            h['sourceRows'].append({'sheet':label,'row':row})
            for p in r.get('D','').split(' + '):
                code={'Edit':'edit','FHR':'fhr','THC':'thc'}.get(p)
                if code and code not in h['programs']:h['programs'].append(code)
            h['brand']=h['brand'] or r.get('H' if i==2 else 'E') or None
            h['region']=h['region'] or (r.get('I') if i==2 else None)
            if i==2:
                avg=number(r.get('E'));low=number(r.get('F'))
                if avg and avg>0:h['observations'].append({'averageNightly':avg,'lowestSeen':low,'nightsSampled':number(r.get('G')),'sitesCompared':number(r.get('J')),'matchedListing':r.get('K') or None,'sheet':label,'row':row})
            elif r.get('F'):h['unpricedReason']=r['F']
    for h in props.values():
        observations=h['observations']
        if observations:
            avgs=[o['averageNightly'] for o in observations]
            # Use the highest of conflicting workbook averages for filtering
            # and estimates; show the complete range, never invent an average.
            h['averageNightly']=max(avgs)
            h['lowestSeen']=min([o['lowestSeen'] for o in observations if o['lowestSeen'] is not None],default=None)
            h['priceRange']=[min(avgs),max(avgs)]
            if len(set(avgs))>1:conflicts.append(h['id'])
    hotels=list(props.values())
    notes={r.get('A'):r.get('B') for _,r in sheets[4] if r.get('A')}
    meta={'sourceFile':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'collectedAt':'2026-11-24','sampledNights':['2026-12-08','2027-01-13','2027-02-06'],'currency':'USD','priceBasis':'Public booking-site average, before taxes and resort fees. Not a card-portal quote.','sourceRows':sum(len(sheets[i])-1 for i in [2,3]),'pricedSourceRows':len(sheets[2])-1,'unpricedSourceRows':len(sheets[3])-1,'under350SourceRows':len(sheets[1])-1,'uniqueHotels':len(hotels),'exactDuplicateRowsMerged':sum(len(h['sourceRows'])-1 for h in hotels),'conflictingPriceHotels':conflicts,'programCounts':{p:sum(p in h['programs'] for h in hotels) for p in ['edit','fhr','thc']},'workbookNotes':notes,'coverageNote':'Workbook notes claim 3,874 unique hotels; supplied sheets contain 3,750 rows and 3,729 distinct name/city/country identities. The list is not a complete or live issuer directory.'}
    return {'metadata':meta,'hotels':hotels}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('path',nargs='?',type=Path,default=DEFAULT);args=parser.parse_args()
    result=build(args.path)
    (ROOT/'src/data/hotels/workbook.generated.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps(result['metadata'],ensure_ascii=False,indent=2))
