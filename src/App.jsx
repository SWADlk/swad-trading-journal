import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Download, Upload, Plus, Trash2, Edit3, Save } from "lucide-react";
import logo from "./assets/SWAD mini.png";  // ✅ place your logo inside src/assets

const DEFAULT_FORM = {
  id: undefined,
  date: new Date().toISOString().slice(0, 10),
  symbol: "XAUUSD",
  side: "LONG",
  timeframe: "M15",
  setup: "Pivot+EMA+MACD",
  size: 1,
  entry: 0,
  stopLevel: 0,
  takeProfit: 0,
  actualExit: 0,
  fees: 0,
  pnl: 0,
  rMultiple: 0,
  notes: "",
  screenshot: "",
  emotion: "",
  strategy: "",
  result: "",
};

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function loadTrades() { try { const raw = localStorage.getItem("trading_journal_trades"); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function saveTrades(trades) { localStorage.setItem("trading_journal_trades", JSON.stringify(trades)); }

function toCSV(rows) {
  const headers = ["id","date","symbol","side","timeframe","setup","size","entry","stopLevel","takeProfit","actualExit","fees","pnl","rMultiple","notes","screenshot","emotion","strategy","result"];
  const escape = (s) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach(r => { lines.push(headers.map(h => escape(r[h])).join(",")); });
  return lines.join("\n");
}

function fromCSV(text) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(",").map(h => h.replaceAll('"', ''));
  return lines.map(line => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='\"'){ if(inQ && line[i+1]==='\"'){cur+='\"'; i++;} else {inQ=!inQ;} }
      else if(c===',' && !inQ){ cols.push(cur); cur=''; } else { cur+=c; }
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i]);
    ["size","entry","stopLevel","takeProfit","actualExit","fees","pnl","rMultiple"].forEach(f => obj[f] = Number(obj[f]||0));
    return obj;
  });
}

function Input({ label, ...props}){ return (<label className="grid gap-1 text-sm"><span className="text-gray-600">{label}</span><input className="px-3 py-2 rounded-xl border focus:outline-none focus:ring w-full" {...props} /></label>); }

function Button({ children, className = "", ...props}){ return (<button className={"px-3 py-2 rounded-2xl shadow-sm border bg-white hover:bg-gray-50 active:scale-[.99] transition " + className} {...props}>{children}</button>); }

export default function App() {
  const [trades, setTrades] = useState(loadTrades());
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(()=>{ saveTrades(trades); }, [trades]);

  // Compute equity curve
  const equityData = useMemo(() => {
    const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
    let cumulative = 0;
    return sorted.map(t => {
      cumulative += Number(t.pnl || 0);
      return { date: t.date, equity: cumulative };
    });
  }, [trades]);

  function calcDerived(next){
    const { entry, actualExit, stopLevel, takeProfit, size, fees } = next;
    const pnl = ((Number(actualExit)||0) - (Number(entry)||0)) * (Number(size)||0) - (Number(fees)||0);
    const risk = Math.abs((Number(entry)||0) - (Number(stopLevel)||0));
    const rMultiple = risk>0?((Number(actualExit)||0)-(Number(entry)||0))/risk:0;
    let result="";
    if(pnl>0) result="Win"; else if(pnl<0) result="Loss"; else result="Breakeven";
    return {...next,pnl:Number(pnl.toFixed(2)), rMultiple:Number(rMultiple.toFixed(2)), result};
  }

  function resetForm(){ setForm({...DEFAULT_FORM,id:undefined}); setEditingId(null); }
  function openNew(){ resetForm(); setShowForm(true); }
  function openEdit(t){ setForm({...t}); setEditingId(t.id); setShowForm(true); }

  function saveForm(e){ e?.preventDefault(); const data = calcDerived(form); if(!data.symbol || !data.date) return alert("Date & Symbol required"); if(editingId){ setTrades(prev=>prev.map(t=>t.id===editingId?data:t)); } else { data.id=uid(); setTrades(prev=>[...prev,data]); } setShowForm(false); resetForm(); }
  function remove(id){ if(!confirm("Delete this trade?")) return; setTrades(prev=>prev.filter(t=>t.id!==id)); }
  function exportCSV(){ const csv = toCSV(trades); const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" }); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`trading_journal_${Date.now()}.csv`; a.click(); }
  function importCSV(file){ const reader=new FileReader(); reader.onload=(e)=>{ try{ const rows=fromCSV(String(e.target.result||"")); const normalized=rows.map(r=>({...DEFAULT_FORM,...r,id:r.id||uid()})); setTrades(prev=>[...prev,...normalized]); } catch{ alert("Failed to import CSV"); } }; reader.readAsText(file); }
  function clearAll(){ if(!confirm("This will erase ALL saved trades. Proceed?")) return; setTrades([]); localStorage.removeItem("trading_journal_trades"); }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex gap-2 mb-4">
        <Button onClick={openNew}><Plus /> New Trade</Button>
        <Button onClick={exportCSV}><Download /> Export CSV</Button>
        <Button onClick={()=>document.getElementById("import-file")?.click()}><Upload /> Import CSV</Button>
        <input type="file" id="import-file" accept=".csv" className="hidden" onChange={e=>importCSV(e.target.files[0])}/>
        <Button onClick={clearAll}><Trash2 /> Clear All</Button>
      </div>
      {/* App Header */}
      <div className="flex items-center gap-4 mb-6">
      <img src={logo} alt="SWAD Logo" className="w-14 h-14 rounded-full shadow-md" />
      <h1 className="text-3xl font-bold text-gray-800">SWAD Trading Journal</h1>
      </div>


      {showForm && <form onSubmit={saveForm} className="bg-white p-4 rounded-xl shadow-md mb-4 grid gap-2">
        <Input label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
        <Input label="Symbol" value={form.symbol} onChange={e=>setForm({...form,symbol:e.target.value})} />
        <Input label="Side" value={form.side} onChange={e=>setForm({...form,side:e.target.value})} />
        <Input label="Timeframe" value={form.timeframe} onChange={e=>setForm({...form,timeframe:e.target.value})} />
        <Input label="Setup" value={form.setup} onChange={e=>setForm({...form,setup:e.target.value})} />
        <Input label="Size" type="number" value={form.size} onChange={e=>setForm({...form,size:Number(e.target.value)})} />
        <Input label="Entry" type="number" value={form.entry} onChange={e=>setForm({...form,entry:Number(e.target.value)})} />
        <Input label="Stop Level" type="number" value={form.stopLevel} onChange={e=>setForm({...form,stopLevel:Number(e.target.value)})} />
        <Input label="Take Profit" type="number" value={form.takeProfit} onChange={e=>setForm({...form,takeProfit:Number(e.target.value)})} />
        <Input label="Actual Exit" type="number" value={form.actualExit} onChange={e=>setForm({...form,actualExit:Number(e.target.value)})} />
        <Input label="Fees" type="number" value={form.fees} onChange={e=>setForm({...form,fees:Number(e.target.value)})} />
        <Input label="Screenshot URL (optional)" placeholder="https://..." value={form.screenshot} onChange={e=>setForm({...form, screenshot: e.target.value})} />
        <Input label="Emotion" value={form.emotion} onChange={e=>setForm({...form,emotion:e.target.value})} />
        <Input label="Strategy" value={form.strategy} onChange={e=>setForm({...form,strategy:e.target.value})} />
        <Input label="Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
        <div className="flex gap-2 mt-2">
          <Button type="submit"><Save /> Save</Button>
          <Button type="button" onClick={()=>setShowForm(false)}>Cancel</Button>
        </div>
      </form>}

      <div className="overflow-x-auto bg-white rounded-xl shadow-md mb-6">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Date</th><th className="p-2">Symbol</th><th className="p-2">Side</th>
              <th className="p-2">Timeframe</th><th className="p-2">Setup</th><th className="p-2">Size</th>
              <th className="p-2">Entry</th><th className="p-2">Stop</th><th className="p-2">Take Profit</th>
              <th className="p-2">Actual Exit</th><th className="p-2">Fees</th><th className="p-2">PnL</th>
              <th className="p-2">R:R</th><th className="p-2">Screenshot</th><th className="p-2">Emotion</th>
              <th className="p-2">Strategy</th><th className="p-2">Result</th><th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t=>(
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-2">{t.date}</td><td className="p-2">{t.symbol}</td><td className="p-2">{t.side}</td>
                <td className="p-2">{t.timeframe}</td><td className="p-2">{t.setup}</td><td className="p-2">{t.size}</td>
                <td className="p-2">{t.entry}</td><td className="p-2">{t.stopLevel}</td><td className="p-2">{t.takeProfit}</td>
                <td className="p-2">{t.actualExit}</td><td className="p-2">{t.fees}</td>
                <td className={`p-2 ${t.pnl>0?"text-green-600":t.pnl<0?"text-red-600":""}`}>{t.pnl.toFixed(2)}</td>
                <td className={`p-2 ${t.rMultiple>0?"text-green-600":t.rMultiple<0?"text-red-600":""}`}>{t.rMultiple.toFixed(2)}</td>
                <td className="p-2">
                  {t.screenshot && <a href={t.screenshot} target="_blank" className="underline text-blue-600">link</a>}
                </td>
                <td className="p-2">{t.emotion}</td><td className="p-2">{t.strategy}</td>
                <td className={`p-2 font-semibold ${t.result==="Win"?"text-green-600":t.result==="Loss"?"text-red-600":"text-gray-600"}`}>{t.result}</td>
                <td className="p-2 flex gap-1">
                  <Button onClick={()=>openEdit(t)}><Edit3 /></Button>
                  <Button onClick={()=>remove(t.id)}><Trash2 /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Equity Curve */}
      <div className="bg-white p-4 rounded-xl shadow-md">
        <h2 className="font-semibold mb-2">Equity Curve</h2>
        {equityData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => value.toFixed(2)} />
              <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500">No trades yet to display.</p>
        )}
      </div>
    </div>
  );
}
