import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Bookmark, Check, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import catalog from "../../data/hotels/workbook.generated.json";
import photography from "../../data/hotels/photos.generated.json";
import { normalizeProfile } from "../../engine/profileDefaults.js";
import { estimateStay, filterStays, programAccess, discoveryMark, discoveryMarksWith, PROGRAM_LABELS } from "../../engine/v5/hotelDiscovery.js";
import { cardDisplayName } from "../../data/cardNames.js";
import { BY_ID } from "../../data/cards/index.js";
import HotelMapView from "./HotelMapView.jsx";
import { buildMarkers } from "../../engine/v5/hotelWorld.js";
import { programBadge, programInfo, PROGRAM_MENU_LABEL, PROGRAM_MENU_NOTE } from "../../engine/v5/hotelPrograms.js";
import "../../styles/v7/hotelDiscovery.css";
const money=n=>`$${Math.round(n).toLocaleString("en-US")}`;
const hotels=catalog.hotels.map(h=>({...h,photo:photography.photos[h.id]||null}));
const countries=[...new Set(hotels.map(h=>h.country))].sort();
const count=n=>n.toLocaleString("en-US");
function PropertyPhoto({hotel,hero=false}) {
 const [failed,setFailed]=useState(false);
 return hotel.photo&&!failed?<img src={hotel.photo.url} alt={`${hotel.name}, ${hotel.city}`} loading={hero?"eager":"lazy"} decoding="async" onError={()=>setFailed(true)}/>:<div className="stay-no-photo"><span>{hotel.city}</span><small>Property photo unavailable</small></div>;
}
function PropertyMap({rows,onChoose,onPick}) {
 const {markers,unmapped}=useMemo(()=>buildMarkers(rows,h=>h.coords),[rows]);
 return <HotelMapView markers={markers} unmapped={unmapped.length} ariaLabel="Map of workbook hotel locations" onShowCity={m=>onChoose(m.name)} onPickHotel={onPick} priceOf={h=>h.averageNightly}/>;
}
/* Which of this hotel's programs the person's cards unlock, in plain words. */
function accessLine(h,profile) {
 const held=h.programs.filter(p=>programAccess(p,profile).held.length);
 if(held.length)return <><Check size={12}/> Credit applies: {held.map(p=>programInfo(p).name).join(" + ")} via your {[...new Set(held.flatMap(p=>programAccess(p,profile).held.map(id=>cardDisplayName(BY_ID[id]))))].join(", ")}</>;
 return `Needs ${[...new Set(h.programs.map(p=>programInfo(p).card))].join(" or ")} for the hotel credit`;
}
export default function HotelDiscovery({profile:raw,onSaveProfile,onCreditView,initialSearch=""}) {
 const profile=useMemo(()=>normalizeProfile(raw),[raw]);
 const [query,setQuery]=useState(initialSearch),[programs,setPrograms]=useState([]),[country,setCountry]=useState("");
 const [scope,setScope]=useState("under350"),[savedOnly,setSavedOnly]=useState(false),[heldOnly,setHeldOnly]=useState(false),[sort,setSort]=useState("photos"),[view,setView]=useState("list"),[shown,setShown]=useState(24),[selected,setSelected]=useState(null);
 const marks=Object.fromEntries(hotels.map(h=>[h.id,discoveryMark(profile,h)]));
 const saveHotel=id=>onSaveProfile?.({...profile,hotelMarks:discoveryMarksWith(profile,hotels.find(h=>h.id===id),marks[id]==="stay"?null:"stay")});
 const rows=useMemo(()=>filterStays(hotels,{query,programs,country,maxPrice:scope==="under350"?350:Infinity,includeUnpriced:scope==="all",savedOnly,marks,sort,heldOnly,profile}),[query,programs,country,scope,savedOnly,marks,sort,heldOnly,profile]);
 useEffect(()=>setShown(24),[query,programs,country,scope,savedOnly,heldOnly,sort]);
 const feature=hotels.find(h=>h.photo&&h.averageNightly<350)||hotels.find(h=>h.photo);
 const toggle=p=>setPrograms(programs.includes(p)?programs.filter(x=>x!==p):[...programs,p]);
 const savedCount=Object.values(marks).filter(m=>m==="stay").length;
 return <section className="page stay-discovery" data-testid="hotel-discovery">
  <header className="stay-hero">
   <div className="stay-hero-copy"><p className="t-eyebrow">THE CARDWISE HOTEL EDIT</p><h1>Find a<br/>remarkable stay.</h1><p className="stay-intro">Explore exceptional hotels. See where your cards work, what a stay could cost, and what the credit actually saves.</p>
    <div className="stay-hero-meta"><span><strong>{count(hotels.length)}</strong> hotels</span><span><strong>3</strong> collections</span><span>Research collected<br/><strong>Nov 24, 2026</strong></span></div>
   </div>
   {feature?<button className="stay-feature" onClick={()=>setSelected(feature)} aria-label={`Explore featured ${feature.name}`}><PropertyPhoto hotel={feature} hero/><span className="stay-feature-caption"><span>{feature.city}, {feature.country}<strong>{feature.name}</strong></span><ArrowUpRight size={24}/></span></button>:<div className="stay-feature stay-feature-empty"><MapPin size={48}/><span>Every stay starts with a place.</span><small>Verified property photography is being matched.</small></div>}
  </header>
  <div className="stay-search-bar"><Search size={20} aria-hidden="true"/><input type="search" aria-label="Search hotels, cities or countries" placeholder="Where would you like to stay?" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Country" value={country} onChange={e=>setCountry(e.target.value)}><option value="">Anywhere</option>{countries.map(c=><option key={c}>{c}</option>)}</select></div>
  <p className="stay-programs-label" id="stay-programs-label" data-testid="program-menu-label"><strong>{PROGRAM_MENU_LABEL}</strong></p><div className="stay-collections" role="group" aria-labelledby="stay-programs-label">{Object.entries(PROGRAM_LABELS).map(([p,label])=><button type="button" key={p} aria-pressed={programs.includes(p)} onClick={()=>toggle(p)}><span className={`stay-collection-symbol ${p}`}>{p==="edit"?"e.":p==="fhr"?"FHR":"THC"}</span><span>{label} ({programInfo(p).issuer})<small>{count(catalog.metadata.programCounts[p])} hotels · {programInfo(p).card}</small></span>{programs.includes(p)&&<Check size={16}/>}</button>)}</div>
  <p className="stay-programs-note t-caption" data-testid="program-note">{PROGRAM_MENU_NOTE} {programs.length?`Showing ${programs.map(p=>programInfo(p).label).join(" + ")} only.`:"Showing all three programs."}</p>
  <div className="stay-toolbar">
   <div className="stay-scope">{[["under350","Under $350"],["priced","All priced"],["all","All hotels"]].map(([k,label])=><button key={k} aria-pressed={scope===k} onClick={()=>setScope(k)}>{label}</button>)}</div>
   <button className="stay-filter-toggle" aria-pressed={heldOnly} onClick={()=>setHeldOnly(!heldOnly)}>With my cards</button>
   <button className="stay-filter-toggle" aria-pressed={savedOnly} onClick={()=>setSavedOnly(!savedOnly)}><Bookmark size={14}/> Saved stays{savedCount?` (${savedCount})`:""}</button>
   <div className="stay-view" role="radiogroup" aria-label="Hotel view">{["list","map"].map(v=><button key={v} role="radio" aria-checked={view===v} onClick={()=>setView(v)}>{v==="list"?"Gallery":"Map"}</button>)}</div>
  </div>
  <div className="stay-results-head"><div><h2>{savedOnly?"Your saved stays":query?`Stays matching “${query}”`:"Places worth discovering"}</h2><p>{count(rows.length)} hotels{scope==="under350"?" under $350 before taxes":""} · Public-rate snapshots, not live quotes</p></div><label><SlidersHorizontal size={14}/><select aria-label="Sort hotels" value={sort} onChange={e=>setSort(e.target.value)}><option value="photos">With photos first</option><option value="price">Price: low to high</option><option value="name">Hotel name</option></select></label></div>
  {view==="map"?<PropertyMap rows={rows} onChoose={city=>{setQuery(city);setView("list");}} onPick={h=>setSelected(h)}/>:<>
   {!rows.length&&<div className="stay-empty"><MapPin size={30}/><h3>No stays match these filters.</h3><p>Try another place or widen the price range.</p><button className="btn btn-quiet" onClick={()=>{setQuery("");setPrograms([]);setCountry("");setHeldOnly(false);setSavedOnly(false);setScope("all");}}>Reset filters</button></div>}
   <ul className="stay-grid" aria-label="Hotel results">{rows.slice(0,shown).map(h=><li className="stay-card" key={h.id}>
    <div className="stay-card-photo"><button onClick={()=>setSelected(h)} aria-label={`Explore ${h.name}`}><PropertyPhoto hotel={h}/></button><span className="stay-programs">{h.programs.map(p=><span key={p} title={programInfo(p).label}>{programBadge(p)}</span>)}</span><button className="stay-save" aria-label={`${marks[h.id]==="stay"?"Unsave":"Save"} ${h.name}`} aria-pressed={marks[h.id]==="stay"} onClick={()=>saveHotel(h.id)}><Bookmark size={18} fill={marks[h.id]==="stay"?"currentColor":"none"}/></button></div>
    <div className="stay-card-body"><p className="stay-location">{h.city}, {h.country}</p><button className="stay-card-title" onClick={()=>setSelected(h)}>{h.name}</button><p className="stay-brand">{h.brand||"Independent hotel"}</p><div className="stay-card-bottom"><div>{h.averageNightly==null?<strong className="stay-price-missing">Price unavailable</strong>:<><strong className="stay-card-price">{money(h.averageNightly)}</strong><span> / night</span><small>Average before taxes · Nov 24</small></>}</div><button className="stay-details-link" aria-label={`View details for ${h.name}`} onClick={()=>setSelected(h)}><ArrowUpRight size={20}/></button></div><p className="stay-access">{accessLine(h,profile)}</p></div>
   </li>)}</ul>
   {rows.length>shown&&<div className="stay-more"><button className="btn btn-quiet" onClick={()=>setShown(shown+24)}>Discover more stays ({count(rows.length-shown)} left)</button></div>}
  </>}
  <footer className="stay-provenance"><p className="t-eyebrow">A clearer view of the price</p><p>Prices are averages of public booking-site rates for sampled nights in December 2026–February 2027, collected November 24, 2026. Taxes, resort fees and card-program pricing may add to the total. A hotel’s inclusion does not confirm availability for your dates.</p><details><summary>Sources, coverage and photography</summary><p>{catalog.metadata.coverageNote}</p><p>Imported {count(catalog.metadata.sourceRows)} workbook rows; {catalog.metadata.exactDuplicateRowsMerged} exact duplicate identities merged. {count(photography.coverage)} properties have an attributed, verified public photograph. Missing photos are labeled; no unrelated hotel photographs stand in for them.</p><p>{catalog.metadata.workbookNotes['Avg nightly']}</p></details>{onCreditView&&<button className="link" onClick={onCreditView}>Open hotel-credit estimates from your plan <ArrowUpRight size={14}/></button>}</footer>
  {selected&&<StayDetails hotel={selected} profile={profile} onSaveProfile={onSaveProfile} saved={marks[selected.id]==="stay"} onSave={()=>saveHotel(selected.id)} onClose={()=>setSelected(null)}/>}
 </section>;
}
function StayDetails({hotel:h,profile,onSaveProfile,saved,onSave,onClose}) {
 const [nights,setNights]=useState(2),[checkin,setCheckin]=useState(() => new Date(Date.now()+30*864e5).toISOString().slice(0,10));
 const box=useRef(null),close=useRef(null),onCloseRef=useRef(onClose);
 onCloseRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow="hidden";close.current?.focus();
  const key=e=>{if(e.key==="Escape")onCloseRef.current();if(e.key==="Tab"){const all=[...box.current.querySelectorAll('button,a,input,select,summary')].filter(x=>!x.disabled);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  document.addEventListener("keydown",key);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);previous?.focus();};
 },[]);
 const estimate=estimateStay(h,profile,{nights,checkin});
 const updateTravel=(key,value)=>onSaveProfile?.({...profile,travel:{...profile.travel,[key]:value},assumedFields:profile.assumedFields.filter(k=>k!==`travel.${key}`)});
 const quoteUrl=`https://www.google.com/travel/search?q=${encodeURIComponent(`${h.name} ${h.city}`)}&checkin=${checkin}`;
 return createPortal(<div className="v5 stay-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="stay-modal" role="dialog" aria-modal="true" aria-labelledby="stay-detail-title" ref={box}>
  <button ref={close} className="stay-modal-close" aria-label="Close hotel details" onClick={onClose}><X size={20}/></button>
  <div className="stay-modal-photo"><PropertyPhoto hotel={h} hero/>{h.photo&&<a className="stay-photo-credit" href={h.photo.filePage} target="_blank" rel="noreferrer">Photo: {h.photo.author} · {h.photo.license}</a>}</div>
  <div className="stay-modal-content"><p className="t-eyebrow">{h.city}, {h.country}</p><h2 id="stay-detail-title">{h.name}</h2><div className="stay-modal-programs">{h.programs.map(p=><span className="tag" key={p} title={programInfo(p).label}>{programInfo(p).label}</span>)}</div>
   <div className="stay-detail-price">{h.averageNightly==null?<strong>Price unavailable</strong>:<><strong>{money(h.averageNightly)}</strong><span> average / night, before taxes</span></>}<p>Collected Nov 24, 2026. Not a confirmed portal quote.</p></div>
   <div className="stay-dates"><label>Check-in<input type="date" aria-label="Stay check-in" value={checkin} min={new Date().toISOString().slice(0,10)} onChange={e=>{if(e.target.value)setCheckin(e.target.value);}}/></label><label>Nights<select aria-label="Stay nights" value={nights} onChange={e=>setNights(Number(e.target.value))}>{Array.from({length:14},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label><label>Your usual nightly budget<input aria-label="Your nightly hotel budget" type="number" min="0" placeholder="Add budget" value={profile.travel.hotelBudget??""} onChange={e=>updateTravel("hotelBudget",e.target.value===""?null:Number(e.target.value))}/></label></div>
   {estimate.cost!=null&&<div className="stay-cost-breakdown"><h3>A stay with your cards</h3><p>{estimate.priceLabel}</p>{estimate.isExcluded&&<p>You excluded this hotel from your annual credit valuation.</p>}<dl><div><dt>Planning program rate</dt><dd>{money(estimate.programNightly)} / night</dd></div><div><dt>{nights}-night estimated total</dt><dd>{money(estimate.cost)}</dd></div><div><dt>Potential lodging credit{estimate.cardId?` · ${cardDisplayName(BY_ID[estimate.cardId])}`:""}</dt><dd>{money(estimate.credit)}</dd></div><div className="stay-net"><dt>Estimated cost after that credit</dt><dd>{money(estimate.after)}</dd></div></dl>{estimate.savings==null?<p>Add your usual nightly budget to estimate how much the credit saves you.</p>:<p>Estimated savings {money(estimate.savings)} versus your usual hotel budget. This counts the extra cost of choosing this hotel.</p>}<p className="t-caption">Public-rate estimates use {Math.round(profile.travel.hotelMarkup*100)}% portal markup and {Math.round(profile.travel.hotelTaxes*100)}% taxes/fees. Saved and observed portal quotes have no extra markup. Actual charges and unused credit balance must be confirmed. It does not add a stay or a quote to your annual card plan.</p><details><summary>Edit price assumptions</summary><div className="stay-dates">{[['hotelMarkup','Portal markup'],['hotelTaxes','Taxes and fees']].map(([key,label])=><label key={key}>{label} %<input aria-label={`${label} percent`} type="number" min="0" max="100" value={Math.round(profile.travel[key]*100)} onChange={e=>updateTravel(key,Math.max(0,Math.min(100,Number(e.target.value)))/100)}/></label>)}</div></details></div>}
   <div className="stay-booking"><h3>Use the cards you already have</h3>{h.programs.map(p=>{const access=programAccess(p,profile);return <div key={p}><span><strong>{programInfo(p).label}</strong><small>{access.held.length?access.held.map(id=>cardDisplayName(BY_ID[id])).join(", "):`Needs ${programInfo(p).card} for this credit; none assumed`}</small></span><a href={access.bookingUrl} target="_blank" rel="noreferrer">Check program rates <ArrowUpRight size={14}/></a></div>;})}<p className="t-caption">Minimum stays and prepaid booking rules apply. Compare the same room, dates and cancellation policy before booking.</p></div>
   <div className="stay-detail-actions"><button className={`btn ${saved?'btn-quiet':'btn-ink'}`} onClick={onSave} aria-pressed={saved}><Bookmark size={16}/>{saved?"Saved hotel":"Save hotel"}</button><a className="btn btn-quiet" href={quoteUrl} target="_blank" rel="noreferrer">Compare public rates <ArrowUpRight size={16}/></a></div>
   <details className="stay-source-details"><summary>Price source and photo credit</summary><p>Source workbook: {catalog.metadata.sourceFile}. {h.sourceRows.map(r=>`${r.sheet}, row ${r.row}`).join("; ")}. {h.unpricedReason||catalog.metadata.priceBasis}</p>{h.lowestSeen!=null&&<p>Lowest single site rate seen: {money(h.lowestSeen)}. This is not the average or a guaranteed booking rate.</p>}{h.photo?<p>Photograph by {h.photo.author}. <a href={h.photo.filePage} target="_blank" rel="noreferrer">Original photograph</a> · <a href={h.photo.licenseUrl} target="_blank" rel="noreferrer">{h.photo.license}</a>.</p>:<p>No verified photograph is on file for this property.</p>}</details>
  </div>
 </div></div>,document.body);
}
