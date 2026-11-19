/* ============================================================================
   connector/src/mockbank/server.js — a fake bank for end-to-end tests.
   Login form → session cookie → offers page that loads its offers from a JSON
   API (like real banks do) and has per-offer "Add" buttons.
   Username: demo  Password: demo-pass   (anything else fails)
   ========================================================================== */

import { pathToFileURL } from "node:url";
import http from "node:http";
import { randomBytes } from "node:crypto";

export function createMockBank() {
  const sessions = new Set();
  const offers = [
    { id: "nk-1", merchant: { name: "Nike" }, headline: "Spend $100 or more, get $20 back", endDate: "2099-12-31", state: "ELIGIBLE" },
    { id: "wm-1", merchant: { name: "Walmart" }, headline: "Get 10% back, up to $15", endDate: "2099-11-30", state: "ELIGIBLE" },
    { id: "ms-1", merchant: { name: "Microsoft Store" }, headline: "Spend $75, get $10 back", endDate: "2099-10-01", state: "ENROLLED" },
  ];
  const cookie = (req) => (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("mb="))?.slice(3);
  const authed = (req) => sessions.has(cookie(req));
  const html = (res, body, code = 200) => { res.writeHead(code, { "content-type": "text/html" }); res.end(`<!doctype html><html><body style="font-family:sans-serif;margin:24px">${body}</body></html>`); };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/login" && req.method === "GET") {
      return html(res, `<h1>Mock Bank</h1><form method="post" action="/login">
        <input id="user" name="user" placeholder="Username" style="display:block;width:300px;height:40px;margin:8px 0">
        <input id="pass" name="pass" type="password" placeholder="Password" style="display:block;width:300px;height:40px;margin:8px 0">
        <button id="signin" type="submit" style="width:300px;height:44px">Sign in</button></form>`);
    }
    if (url.pathname === "/login" && req.method === "POST") {
      let body = ""; req.on("data", (c) => { body += c; }); req.on("end", () => {
        const p = new URLSearchParams(body);
        if (p.get("user") === "demo" && p.get("pass") === "demo-pass") {
          const sid = randomBytes(16).toString("hex"); sessions.add(sid);
          res.writeHead(302, { "set-cookie": `mb=${sid}; Path=/; HttpOnly`, location: "/offers" }); return res.end();
        }
        html(res, `<p id="err">Wrong username or password</p><a href="/login">Try again</a>`, 401);
      });
      return;
    }
    if (!authed(req)) { res.writeHead(302, { location: "/login" }); return res.end(); }
    if (url.pathname === "/offers") {
      return html(res, `<div id="account-name">Mock Gold Card</div><div id="account-last4">••1234</div><div id="list"></div>
        <script>
          fetch('/api/offers').then(r=>r.json()).then(({result})=>{
            document.getElementById('list').innerHTML = result.offers.map(o =>
              '<div data-offer-id="'+o.id+'"><b class="m">'+o.merchant.name+'</b> '+o.headline+
              (o.state==='ENROLLED' ? ' <span class="added">Added</span>' : ' <button class="add">Add</button>')+'</div>').join('');
            document.querySelectorAll('button.add').forEach(b => b.onclick = () => {
              const id = b.parentElement.dataset.offerId;
              fetch('/api/offers/'+id+'/add',{method:'POST'}).then(()=>{ b.outerHTML='<span class="added">Added</span>'; });
            });
          });
        </script>`);
    }
    if (url.pathname === "/api/offers") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ result: { offers } })); }
    const m = url.pathname.match(/^\/api\/offers\/([\w-]+)\/add$/);
    if (m && req.method === "POST") { const o = offers.find((x) => x.id === m[1]); if (o) o.state = "ENROLLED"; res.writeHead(204); return res.end(); }
    res.writeHead(404); res.end();
  });

  return {
    server, offers,
    expireAllSessions: () => sessions.clear(),
    listen: (port = 8799, host = "127.0.0.1") => new Promise((r) => server.listen(port, host, () => r(server.address().port))),
    close: () => new Promise((r) => server.close(() => r())),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mb = createMockBank();
  mb.listen(Number(process.env.MOCKBANK_PORT || 8799)).then((p) => console.log(`mock bank on http://127.0.0.1:${p}/login  (demo / demo-pass)`));
}
