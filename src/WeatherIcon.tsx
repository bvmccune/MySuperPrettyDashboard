import React from 'react';
import {Image,ImageSourcePropType,useColorScheme} from 'react-native';
import {WeatherIconName,weatherIconName,weatherIconTint} from './weatherIconMapping';
const ASSETS:Record<WeatherIconName,ImageSourcePropType>={
  'sun':require('../assets/pretty/weather-sun.png'),
  'moon':require('../assets/pretty/weather-moon.png'),
  'sun-cloud':require('../assets/pretty/weather-sun-cloud.png'),
  'moon-cloud':require('../assets/pretty/weather-moon-cloud.png'),
  'cloud':require('../assets/pretty/weather-cloud.png'),
  'clouds':require('../assets/pretty/weather-clouds.png'),
  'cloud-fog':require('../assets/pretty/weather-cloud-fog.png'),
  'cloud-rain-alt':require('../assets/pretty/weather-cloud-rain-alt.png'),
  'cloud-rain':require('../assets/pretty/weather-cloud-rain.png'),
  'sun-cloud-rain':require('../assets/pretty/weather-sun-cloud-rain.png'),
  'sun-cloud-lightning':require('../assets/pretty/weather-sun-cloud-lightning.png'),
  'cloud-snow-alt':require('../assets/pretty/weather-cloud-snow-alt.png'),
  'cloud-snow':require('../assets/pretty/weather-cloud-snow.png'),
  'cloud-sleet':require('../assets/pretty/weather-cloud-sleet.png'),
  'wind':require('../assets/pretty/weather-wind.png'),
  'moon-cloud-rain':require('../assets/pretty/weather-moon-cloud-rain.png'),
  'moon-cloud-lightning':require('../assets/pretty/weather-moon-cloud-lightning.png'),
  'cloud-hail':require('../assets/pretty/weather-cloud-hail.png'),
  'na':require('../assets/pretty/weather-na.png'),
};
export function WeatherIcon({condition,size=48,dark,isDay=true,hail=false}:{
  condition:string|null|undefined;size?:number;dark?:boolean;isDay?:boolean;hail?:boolean;
}):React.JSX.Element{
  const scheme=useColorScheme();
  const name=weatherIconName(condition,{isDay,hail});
  return <Image accessible accessibilityLabel={condition?.replace(/-/g,' ')||'Weather unavailable'}
    source={ASSETS[name]} resizeMode="contain"
    style={{width:size,height:size,tintColor:weatherIconTint(dark??(scheme==='dark'))}}/>;
}
