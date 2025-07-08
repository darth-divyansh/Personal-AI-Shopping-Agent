// assistant.js  (replaces your current server file)
import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { promises as fs, existsSync } from "fs";
import fetch from "node-fetch";
import axios from "axios";
import { createWriteStream } from "fs";
import voice from "elevenlabs-node";

import { getOrderStatus, searchOrderByQuery } from "./orderVectorHelper.js";

dotenv.config();
const elevenKey = process.env.ELEVEN_LABS_API_KEY;
const gemKey    = process.env.GEMINI_API_KEY;
const voiceID   = "cgSgspJ2msm6clMCkdW9";
const port      = 3000;

const app = express();
app.use(express.json());
app.use(cors());
if (!existsSync("audios")) await fs.mkdir("audios");

// util helpers (same as before) …
const execCommand = (c)=>new Promise((r,j)=>exec(c,(e,o)=>e?j(e):r(o)));
const genTTS = async(txt,f)=>{ /* identical to your generateTTS */ };
const lipSync = async(i)=>{ /* identical to previous lipSyncMessage */ };
const readJson = (f)=>fs.readFile(f,"utf8").then(JSON.parse);
const b64 = (f)=>fs.readFile(f).then(b=>b.toString("base64"));
const extractORD = t=>{ const m=t.match(/\\bORD\\d{6,12}\\b/i); return m?m[0].toUpperCase():null; };

app.post("/chat", async (req,res)=>{
  const user = (req.body.message||"").trim();
  if(!user) return res.send({messages:[{text:"Hi, I'm Wally! 😊",facialExpression:"smile",animation:"Talking_1"}]});
  if(!elevenKey||!gemKey) return res.send({messages:[{text:"API keys missing",facialExpression:"angry",animation:"Idle"}]});

  // step 1: exact ID or vector search
  let orderInfo = { found:false };
  const ordId = extractORD(user);
  if(ordId) orderInfo = await getOrderStatus(ordId);
  if(!orderInfo.found) orderInfo = await searchOrderByQuery(user);

  // step 2: build prompt
  const prompt = `
You are Wally, Walmart/Flipkart support.
${orderInfo.found ? `Order status:\n${JSON.stringify(orderInfo)}` : ""}
Respond with JSON array (max3) {text, facialExpression, animation}.
User: ${user}`.trim();

  // step 3: Gemini call
  const g = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${gemKey}`,
    { method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ contents:[{ parts:[{ text:prompt }] }] }) });
  const gData = await g.json();
  let raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text||"[]";
  raw=raw.trim().replace(/^```json/,"").replace(/```$/,"");
  let msgs; try{msgs=JSON.parse(raw);}catch{msgs=[{text:"Sorry, I didn't get that.",facialExpression:"sad",animation:"Idle"}];}

  // step 4: TTS + lipsync
  for(let i=0;i<msgs.length;i++){
    const f=`audios/message_${i}.mp3`;
    await genTTS(msgs[i].text,f).catch(()=>null);
    await lipSync(i).catch(()=>null);
    msgs[i].audio   = await b64(f).catch(()=>"");
    msgs[i].lipsync = await readJson(`audios/message_${i}.json`).catch(()=>[]);
  }
  res.send({messages:msgs});
});

app.listen(port,()=>console.log(`🛒 Assistant on http://localhost:${port}`));
