import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, describeWeather, placeOf, weatherAt } from './weather.ts';

test('the town is read from the location', () => {
  assert.deepEqual(placeOf('Brewster High School Field (50 Foggintown Rd, Brewster NY)'), { town: 'Brewster', state: 'NY' });
  assert.deepEqual(placeOf('35 Angela Dr Carmel, NY, United States'), { town: 'Carmel', state: 'NY' });
  assert.deepEqual(placeOf('Somers HS, Lincolndale, NY 10540'), { town: 'Lincolndale', state: 'NY' });
  assert.deepEqual(placeOf('Mahopac High School - Turf Field'), { town: 'Mahopac', state: 'NY' });
  assert.deepEqual(placeOf('Carmel HS'), { town: 'Carmel', state: 'NY' });
  assert.deepEqual(placeOf(''), { town: 'Mahopac', state: 'NY' });
});

test('the weather at the start hour, with the most rain while it runs', () => {
  const h = {
    time: ['2026-10-11T14:00', '2026-10-11T15:00', '2026-10-11T16:00', '2026-10-11T17:00'],
    temperature_2m: [58.4, 61.2, 60, 57],
    apparent_temperature: [55, 58, 57, 54],
    precipitation_probability: [10, 20, 60, 30],
    weather_code: [3, 61, 63, 3],
    wind_speed_10m: [8.4, 11.6, 12, 9],
  };
  const w = weatherAt(h, '2026-10-11', '15:00', 120, 'Brewster, NY')!;
  assert.equal(w.tempF, 61);
  assert.equal(w.feelsF, 58);
  assert.equal(w.precipChance, 20);
  assert.equal(w.maxPrecipChance, 60);
  assert.equal(w.windMph, 12);
  assert.equal(w.label, 'Rain');
  assert.equal(weatherAt(h, '2026-10-12', '15:00'), null);
  assert.equal(describeWeather(0).label, 'Clear');
  assert.equal(describeWeather(95).label, 'Thunderstorms');
});

test('days until the event', () => {
  const today = new Date(2026, 9, 7);
  assert.equal(daysUntil('2026-10-11', today), 4);
  assert.equal(daysUntil('2026-10-07', today), 0);
  assert.equal(daysUntil('2026-10-01', today), -6);
});
