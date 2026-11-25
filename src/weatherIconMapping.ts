/** Weather Iconic by Konrad Michalik, CC BY-SA 3.0 US. */
export const WEATHER_ICONS = {
  "sunny": "sun",
  "clear-night": "moon",
  "partly-cloudy": "sun-cloud",
  "partly-cloudy-night": "moon-cloud",
  "cloudy": "cloud",
  "overcast": "clouds",
  "fog": "cloud-fog",
  "drizzle": "cloud-rain-alt",
  "rain": "cloud-rain",
  "scattered-showers": "sun-cloud-rain",
  "heavy-rain": "cloud-rain",
  "thunderstorms": "sun-cloud-lightning",
  "snow": "cloud-snow-alt",
  "heavy-snow": "cloud-snow",
  "sleet-hail": "cloud-sleet",
  "windy": "wind"
} as const;
export type WeatherCondition=keyof typeof WEATHER_ICONS;
export type WeatherIconName=typeof WEATHER_ICONS[WeatherCondition] | 'moon-cloud-rain' | 'moon-cloud-lightning' | 'cloud-hail' | 'na';
export function weatherIconName(condition:string|null|undefined,{isDay=true,hail=false}:{isDay?:boolean;hail?:boolean}={}):WeatherIconName{
  if(condition==='scattered-showers'&&!isDay)return 'moon-cloud-rain';
  if(condition==='thunderstorms'&&!isDay)return 'moon-cloud-lightning';
  if(condition==='sleet-hail'&&hail)return 'cloud-hail';
  if(condition==='sunny'&&!isDay)return 'moon';
  if(condition==='partly-cloudy'&&!isDay)return 'moon-cloud';
  return typeof condition==='string'&&Object.prototype.hasOwnProperty.call(WEATHER_ICONS,condition)?WEATHER_ICONS[condition as WeatherCondition]:'na';
}
export function weatherIconTint(dark:boolean):string{return dark?'#ffffff':'#000000';}
