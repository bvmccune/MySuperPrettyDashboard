import {WEATHER_ICONS,weatherIconName,weatherIconTint} from './weatherIconMapping';
test('all 16 conditions map to approved SVGs',()=>{
  expect(Object.keys(WEATHER_ICONS)).toHaveLength(16);
  expect(Object.values(WEATHER_ICONS)).toEqual(["sun","moon","sun-cloud","moon-cloud","cloud","clouds","cloud-fog","cloud-rain-alt","cloud-rain","sun-cloud-rain","cloud-rain","sun-cloud-lightning","cloud-snow-alt","cloud-snow","cloud-sleet","wind"]);
});
test('night and hail variants and unavailable fallback',()=>{
  expect(weatherIconName('sunny',{isDay:false})).toBe('moon');
  expect(weatherIconName('partly-cloudy',{isDay:false})).toBe('moon-cloud');
  expect(weatherIconName('scattered-showers',{isDay:false})).toBe('moon-cloud-rain');
  expect(weatherIconName('thunderstorms',{isDay:false})).toBe('moon-cloud-lightning');
  expect(weatherIconName('sleet-hail',{hail:true})).toBe('cloud-hail');
  expect(weatherIconName('unknown')).toBe('na');
  expect(weatherIconName('constructor')).toBe('na');
  expect(weatherIconTint(false)).toBe('#000000');
  expect(weatherIconTint(true)).toBe('#ffffff');
});
