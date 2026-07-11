const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const PORT = process.env.PORT || 3000;

const ASSET_KEYWORDS = {
  DRAM:  ["drama","feud","beef","controversy","scandal","backlash","fight","diss","clap back","shade","exposed","canceled"],
  FOMO:  ["viral","trend","sold out","hype","everyone","craze","rush","goes viral","trending","breaks internet","record"],
  CRNG:  ["awkward","cringe","embarrassing","fail","flop","disaster","roasted","mocked","booed"],
  GHOST: ["breakup","unfollow","ignored","split","ex ","dating","ghosted","divorce","single"],
  EXNRG: ["relationship","dating","romance","heartbreak","wedding","engaged","married","couple","kiss"],
  MNDY:  ["work","job","layoff","fired","quit","strike","boss","retire","resign"],
  RDBR:  ["energy","win","victory","champion","record","wins","beats","defeats","gold medal","mvp"],
  BATT:  ["battery","phone","iphone","android","tech","gadget","launch","release"],
  DELV:  ["delivery","shipping","late","package","amazon","delayed","tour","concert","canceled show"],
  TABS:  ["youtube","tiktok","streamer","influencer","creator","subscribers","views","podcast","netflix","movie","album","song"],
};
function spiceHeadline(title){const e=["🔥","📈","📉","🚨","💥","⚡","😱","🤯"][Math.floor(Math.random()*8)];const s=title.length>80?title.slice(0,77)+"...":title;return e+" "+s;}
function priceImpact(){const d=Math.random()>0.5?1:-1;return parseFloat((d*(5+Math.random()*30)).toFixed(1));}
async function fetchReddit(){
  const subs=["entertainment","popculturechat","Deuxmoi","celebgossip","sports","nba","soccer","youtube","tiktokcringe","trending","OutOfTheLoop","technology","worldnews"];
  const titles=[];
  for(const sub of subs){try{const res=await fetch("https://www.reddit.com/r/"+sub+"/hot.json?limit=12",{headers:{"User-Agent":"oddex-vibe/1.0"}});const data=await res.json();if(data?.data?.children)for(const p of data.data.children)if(p.data?.title)titles.push(p.data.title);}catch(e){}}
  return titles;
}
let cachedEvents=[],lastFetch=0;
async function fetchNews(){
  if(Date.now()-lastFetch<3*60*1000&&cachedEvents.length>0)return cachedEvents;
  let allTitles=[];
  allTitles=allTitles.concat(await fetchReddit());
  if(NEWS_API_KEY){try{
    const urls=["https://newsapi.org/v2/top-headlines?language=en&category=entertainment&pageSize=25&apiKey="+NEWS_API_KEY,"https://newsapi.org/v2/top-headlines?language=en&category=sports&pageSize=15&apiKey="+NEWS_API_KEY];
    for(const url of urls){const res=await fetch(url);const data=await res.json();if(data.articles)allTitles=allTitles.concat(data.articles.map(a=>a.title).filter(Boolean));}
  }catch(e){console.error("NewsAPI failed:",e.message);}}
  if(allTitles.length===0)return demoEvents();
  const events=[];const symbols=Object.keys(ASSET_KEYWORDS);
  for(const rawTitle of allTitles){
    const title=rawTitle.toLowerCase();let matched=false;
    for(const[symbol,keywords]of Object.entries(ASSET_KEYWORDS)){
      if(keywords.some(k=>title.includes(k))){events.push({symbol,headline:spiceHeadline(rawTitle),impact:priceImpact(),time:Date.now()});matched=true;break;}
    }
    if(!matched&&rawTitle.length>15)events.push({symbol:symbols[Math.floor(Math.random()*symbols.length)],headline:spiceHeadline(rawTitle),impact:priceImpact(),time:Date.now()});
  }
  if(events.length===0)return demoEvents();
  cachedEvents=events.slice(0,25);lastFetch=Date.now();return cachedEvents;
}
function demoEvents(){const symbols=Object.keys(ASSET_KEYWORDS);return symbols.slice(0,8).map(s=>({symbol:s,headline:"📊 Market buzz around "+s+" intensifies",impact:priceImpact(),time:Date.now()}));}

let commentCache={};
async function getAIComment(headline,symbol){
  if(!DEEPSEEK_API_KEY)return null;
  if(commentCache[headline])return commentCache[headline];
  try{
    const res=await fetch("https://api.deepseek.com/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+DEEPSEEK_API_KEY},
      body:JSON.stringify({
        model:"deepseek-chat",
        messages:[
          {role:"system",content:"You are a witty, sarcastic trading-show host for a satirical meme trading game. Given a real news headline and an asset symbol, write ONE short funny reaction (max 15 words) like a hype commentator. No hashtags. Keep it playful and clean."},
          {role:"user",content:'Headline: "'+headline+'". Asset: '+symbol+'. Give your one-line reaction:'}
        ],
        max_tokens:40,temperature:1.0
      })
    });
    const data=await res.json();
    const comment=data?.choices?.[0]?.message?.content?.trim();
    if(comment){commentCache[headline]=comment;return comment;}
  }catch(e){console.error("DeepSeek failed:",e.message);}
  return null;
}
app.get("/",(req,res)=>res.json({status:"ODDEX news backend running"}));
app.get("/debug",async(req,res)=>res.json({newsKeySet:!!NEWS_API_KEY,deepseekKeySet:!!DEEPSEEK_API_KEY}));
app.get("/news",async(req,res)=>{const events=await fetchNews();res.json({events});});
app.get("/comment",async(req,res)=>{
  const headline=req.query.headline||"";const symbol=req.query.symbol||"";
  if(!headline)return res.json({comment:null});
  const comment=await getAIComment(headline,symbol);
  res.json({comment});
});
app.listen(PORT,()=>console.log("News backend running on port "+PORT));
