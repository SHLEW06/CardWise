// @vitest-environment jsdom
import React,{useState} from "react";
import {it as vit,expect,afterEach} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";
/* The owner's workbook is local-only (git-ignored, docs/THIRD_PARTY.md): a
   fresh clone skips these dev-browser tests instead of failing. */
const HAS_WORKBOOK = existsSync(`${process.cwd()}/src/data/hotels/workbook.generated.json`);
const HotelDiscovery = HAS_WORKBOOK ? (await import("../components/v7/HotelDiscovery.jsx")).default : null;
const it = HAS_WORKBOOK ? vit : vit.skip;
import {normalizeProfile} from "../engine/profileDefaults.js";
afterEach(cleanup);
function Harness(){const[p,setP]=useState(normalizeProfile({cardsHeld:["amex-plat"],travel:{hotelBudget:200}}));return <HotelDiscovery profile={p} onSaveProfile={setP}/>;}
it("searches the real workbook, opens cost details, and saves a property",()=>{
 render(<Harness/>);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'NH Collection Royal Quito'}});
 expect(screen.getByText('NH Collection Royal Quito')).toBeInTheDocument();
 expect(screen.getByText('$74')).toBeInTheDocument();
 expect(screen.getAllByText(/before taxes/i).length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole('button',{name:'Explore NH Collection Royal Quito'}));
 expect(screen.getByRole('dialog')).toHaveTextContent('Not a confirmed portal quote');
 fireEvent.click(screen.getByRole('button',{name:'Save hotel'}));
 expect(screen.getByRole('button',{name:'Saved hotel'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'Close hotel details'}));
 fireEvent.click(screen.getByRole('button',{name:/Saved stays/}));
 expect(screen.getByText('NH Collection Royal Quito')).toBeInTheDocument();
});
it("shows missing rates without fabricating a price or savings",()=>{
 render(<Harness/>);
 fireEvent.click(screen.getByRole('button',{name:'All hotels'}));
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Thyme'}});
 fireEvent.click(screen.getByRole('button',{name:'Explore Thyme'}));
 expect(screen.getByRole('dialog')).toHaveTextContent('Price unavailable');
 expect(screen.getByRole('dialog')).not.toHaveTextContent('Estimated savings $');
});
it("filters to programs accessible using held cards and supports the map",()=>{
 render(<Harness/>);
 fireEvent.click(screen.getByRole('button',{name:'With my cards'}));
 expect(screen.queryAllByText('Eligible card required')).toHaveLength(0);
 fireEvent.click(screen.getByRole('radio',{name:'Map'}));
 expect(screen.getByRole('img',{name:'Map of workbook hotel locations'})).toBeInTheDocument();
});
