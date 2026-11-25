import {NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
const {DashboardNative}=NativeModules;
export const WEATHER_REFRESH_MS=15*60*1000;
export type WeatherLocation={name:string;latitude:number;longitude:number};
export const DEFAULT_WEATHER_LOCATION:WeatherLocation={name:'Atlanta, Georgia, US',latitude:33.75,longitude:-84.39};
export type WeatherDay={start:number;sunrise:number;sunset:number;high:number;low:number};
export type WeatherSnapshot={schema:1;location:WeatherLocation;fetchedAt:number;observedAt:number;current:number;code:number;isDay:boolean;wind:number;days:WeatherDay[]};
export type WeatherResult={snapshot:WeatherSnapshot|null;status:'loading'|'fresh'|'cached'|'unavailable';error?:string};
const CACHE='/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/weather-cache.json';
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export function validWeatherLocation(x:any):x is WeatherLocation{
 return !!x&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=150&&finite(x.latitude)&&Math.abs(x.latitude)<=90&&finite(x.longitude)&&Math.abs(x.longitude)<=180;
}
export function locationKey(x:WeatherLocation){return x.latitude.toFixed(4)+','+x.longitude.toFixed(4);}
export function weatherCondition(code:number,wind=0):{condition:string;hail?:boolean}{
 if(code===0||code===1)return {condition:wind>=25?'windy':code===0?'sunny':'partly-cloudy'};
 if(code===2)return {condition:'partly-cloudy'};
 if(code===3)return {condition:'overcast'};
 if([45,48].includes(code))return {condition:'fog'};
 if([51,53,55].includes(code))return {condition:'drizzle'};
 if([56,57,66,67].includes(code))return {condition:'sleet-hail'};
 if([61,63].includes(code))return {condition:'rain'};
 if(code===65||code===82)return {condition:'heavy-rain'};
 if([71,73,77,85].includes(code))return {condition:'snow'};
 if([75,86].includes(code))return {condition:'heavy-snow'};
 if([80,81].includes(code))return {condition:'scattered-showers'};
 if([95,96,99].includes(code))return {condition:'thunderstorms',hail:code!==95};
 return {condition:'unavailable'};
}
export function weatherForecastUrl(location:WeatherLocation):string{
 if(!validWeatherLocation(location))throw new Error('Invalid weather location');
 return 'https://api.open-meteo.com/v1/forecast?latitude='+location.latitude+'&longitude='+location.longitude+
 '&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&timeformat=unixtime&forecast_days=2';
}
export function normalizeWeather(raw:any,location:WeatherLocation,now=Date.now()):WeatherSnapshot{
 const c=raw?.current,d=raw?.daily;
 if(!validWeatherLocation(location)||!c||!d||![c.temperature_2m,c.weather_code,c.time,c.wind_speed_10m].every(finite)||![0,1].includes(c.is_day)||!Array.isArray(d.time))throw new Error('Weather response is incomplete');
 const days:WeatherDay[]=d.time.map((start:any,i:number)=>{
 const high=d.temperature_2m_max?.[i],low=d.temperature_2m_min?.[i],sunrise=d.sunrise?.[i],sunset=d.sunset?.[i];
 if(![start,high,low,sunrise,sunset].every(finite)||high<low||sunset<=sunrise)throw new Error('Daily weather is incomplete');
 return {start:start*1000,high,low,sunrise:sunrise*1000,sunset:sunset*1000};
 });
 if(!days.length||days.some((day,i)=>i>0&&day.start<=days[i-1].start))throw new Error('Invalid forecast dates');
 return {schema:1,location,fetchedAt:now,observedAt:c.time*1000,current:c.temperature_2m,code:c.weather_code,isDay:c.is_day===1,wind:c.wind_speed_10m,days};
}
export function weatherDay(s:WeatherSnapshot,now=Date.now()):WeatherDay|null{
 for(let i=s.days.length-1;i>=0;i--){const d=s.days[i];if(now>=d.start&&now<(s.days[i+1]?.start??d.start+24*3600000))return d;}return null;
}
export function weatherIsDay(s:WeatherSnapshot,now=Date.now()):boolean{
 const d=weatherDay(s,now);return d?now>=d.sunrise&&now<d.sunset:s.isDay;
}
function validSnapshot(x:any,l:WeatherLocation):x is WeatherSnapshot{
 return x?.schema===1&&validWeatherLocation(x.location)&&locationKey(x.location)===locationKey(l)&&[x.fetchedAt,x.observedAt,x.current,x.code,x.wind].every(finite)&&typeof x.isDay==='boolean'&&Array.isArray(x.days)&&x.days.length>0&&x.days.every((d:any)=>d&&[d.start,d.sunrise,d.sunset,d.high,d.low].every(finite)&&d.high>=d.low&&d.sunset>d.sunrise);
}
let permitted=false;
export async function getWeatherJson(url:string){
 if(!permitted){const k='plugin.permission.INTERNET';let p=await PluginManager.hasPermission(k);if(p!==1&&p!==2)p=await PluginManager.requestPermission(k,'Detect approximate internet location and retrieve local weather.');if(p!==1&&p!==2)throw new Error('Weather internet permission denied');permitted=true;}
 let last:unknown;
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const r=await fetch(url,{method:'GET',signal:controller.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Weather HTTP '+r.status);return await r.json();}
  catch(e:any){last=e;if(/^Weather HTTP 4/.test(String(e?.message)))break;}
  finally{clearTimeout(timer);}
 }
 const error=last as any;
 const host=url.startsWith('https://ipapi.co/')?'ipapi.co':url.startsWith('https://geocoding-api.open-meteo.com/')?'geocoding-api.open-meteo.com':'api.open-meteo.com';
 const detail=error?.name==='AbortError'?'Request timed out':String(error?.message||'Network request failed');
 if(!/^Weather HTTP 4/.test(detail)&&typeof DashboardNative?.fetchOpenMeteoJson==='function'){
  try{return JSON.parse(await DashboardNative.fetchOpenMeteoJson(url));}
  catch(e:any){throw new Error(host+': '+detail+'; '+String(e?.message||'Native HTTPS request failed'));}
 }
 throw new Error(host+': '+detail);
}
const memory=new Map<string,WeatherSnapshot>(),pending=new Map<string,Promise<WeatherResult>>();
async function cached(l:WeatherLocation):Promise<WeatherSnapshot|null>{
 const prior=memory.get(locationKey(l));if(prior)return prior;
 try{const x=JSON.parse(await DashboardNative.readTextFile(CACHE)||'null');if(validSnapshot(x,l)){memory.set(locationKey(l),x);return x;}}catch{}return null;
}
export function refreshWeather(l:WeatherLocation,force=false):Promise<WeatherResult>{
 const key=locationKey(l),p=pending.get(key);if(p)return p;
 const request=(async():Promise<WeatherResult>=>{
 const prior=await cached(l);
 if(!force&&prior&&Date.now()-prior.fetchedAt<WEATHER_REFRESH_MS)return {snapshot:prior,status:'fresh'};
 try{const snap=normalizeWeather(await getWeatherJson(weatherForecastUrl(l)),l);memory.set(key,snap);try{await DashboardNative.writeFile(CACHE,JSON.stringify(snap));}catch{}return {snapshot:snap,status:'fresh'};}
 catch(e:any){return {snapshot:prior,status:prior?'cached':'unavailable',error:String(e?.message||e)};}
 })().finally(()=>pending.delete(key));pending.set(key,request);return request;
}
export async function searchWeatherLocations(query:string):Promise<WeatherLocation[]>{
 const q=query.trim();if(q.length<2)throw new Error('Enter a city or ZIP code');
 const data=await getWeatherJson('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=8&language=en&format=json');
 return (Array.isArray(data?.results)?data.results:[]).map((r:any)=>({name:[r.name,r.admin1,r.country_code].filter(Boolean).join(', '),latitude:r.latitude,longitude:r.longitude})).filter(validWeatherLocation);
}

/** Automatic public-IP geolocation. Store only city and coordinates, never the IP itself.
 * Legacy manually configured Atlanta/city preferences are not used by this path. */
const AUTO_LOCATION='/storage/emulated/0/MyStyle/Plugins/MySuperPrettyDashboard/weather-auto-location.json';
let automaticLocation:WeatherLocation|null=null, detectedAt=0;
let autoPending:Promise<WeatherResult>|null=null;
export function normalizeAutomaticLocation(raw:any):WeatherLocation{
 const location={name:[raw?.city,raw?.region,raw?.country_code??raw?.country].filter((v:any)=>typeof v==='string'&&v.trim()).join(', '),latitude:raw?.latitude,longitude:raw?.longitude};
 if(raw?.error||typeof raw?.city!=='string'||!validWeatherLocation(location))throw new Error('Automatic location unavailable');
 return location;
}
export async function readAutomaticLocation():Promise<WeatherLocation|null>{
 if(automaticLocation)return automaticLocation;
 try{const value=JSON.parse(await DashboardNative.readTextFile(AUTO_LOCATION)||'null');if(validWeatherLocation(value)){automaticLocation={name:value.name,latitude:value.latitude,longitude:value.longitude};return automaticLocation;}}catch{}
 return null;
}
export function refreshAutomaticWeather(force=false):Promise<WeatherResult>{
 if(autoPending)return autoPending;
 autoPending=(async():Promise<WeatherResult>=>{
  const last=await readAutomaticLocation();
  let location=last,locationError:string|undefined;
  if(force||!location||Date.now()-detectedAt>=WEATHER_REFRESH_MS){
   try{
    location=normalizeAutomaticLocation(await getWeatherJson('https://ipapi.co/json/'));
    automaticLocation=location;detectedAt=Date.now();
    try{await DashboardNative.writeFile(AUTO_LOCATION,JSON.stringify(location));}catch{}
   }catch(e:any){locationError=String(e?.message||'Automatic location unavailable');}
  }
  if(!location)return {snapshot:null,status:'unavailable',error:locationError||'Automatic location unavailable'};
  const weather=await refreshWeather(location,force);
  if(locationError)return {...weather,status:weather.snapshot?'cached':'unavailable',error:'Location not verified: '+locationError+(weather.error?'; '+weather.error:'')};
  return weather;
 })().finally(()=>{autoPending=null;});
 return autoPending;
}
