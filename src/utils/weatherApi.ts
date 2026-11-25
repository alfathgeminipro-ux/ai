import type { WeatherData } from '../types';

export function describeWmoCode(code: number): string {
  if (code === 0) return 'Cerah';
  if (code === 1 || code === 2) return 'Cerah Berawan';
  if (code === 3) return 'Berawan';
  if (code === 45 || code === 48) return 'Berkabut';
  if (code >= 51 && code <= 57) return 'Gerimis Ringan';
  if (code >= 61 && code <= 65) return 'Hujan';
  if (code >= 66 && code <= 67) return 'Hujan Dingin';
  if (code >= 80 && code <= 82) return 'Hujan Lokal';
  if (code >= 95) return 'Badai Petir';
  return 'Berawan';
}

export const FALLBACK_WEATHER: WeatherData = {
  city: 'Jakarta',
  country: 'Indonesia',
  temperature: 30,
  apparentTemp: 33,
  humidity: 68,
  windSpeed: 12,
  condition: 'Cerah Berawan',
  code: 2,
  hourly: [
    { time: '10:00', temp: 29, code: 1 },
    { time: '12:00', temp: 31, code: 2 },
    { time: '14:00', temp: 32, code: 2 },
    { time: '16:00', temp: 30, code: 3 },
    { time: '18:00', temp: 28, code: 61 },
  ],
  updatedAt: 'Baru saja',
};

/**
 * Mengambil data cuaca real-time melalui Open-Meteo API tanpa memerlukan API key.
 */
export async function fetchWeatherForCity(cityName: string): Promise<WeatherData> {
  const query = cityName.trim() || 'Jakarta';
  let lat = -6.2088;
  let lon = 106.8456;
  let resolvedCity = query;
  let country = 'Indonesia';

  try {
    const geoCtrl = new AbortController();
    const geoTimer = setTimeout(() => geoCtrl.abort(), 6000);
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=id&format=json`,
      { signal: geoCtrl.signal },
    );
    clearTimeout(geoTimer);

    if (geoRes.ok) {
      const geoData = (await geoRes.json()) as {
        results?: Array<{ name: string; country?: string; latitude: number; longitude: number }>;
      };
      if (geoData.results && geoData.results.length > 0) {
        const hit = geoData.results[0];
        lat = hit.latitude;
        lon = hit.longitude;
        resolvedCity = hit.name;
        country = hit.country ?? '';
      }
    }

    const wxCtrl = new AbortController();
    const wxTimer = setTimeout(() => wxCtrl.abort(), 6000);
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_days=1&timezone=auto`,
      { signal: wxCtrl.signal },
    );
    clearTimeout(wxTimer);

    if (!wxRes.ok) throw new Error('Gagal memuat Open-Meteo');

    const wx = (await wxRes.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      hourly?: {
        time: string[];
        temperature_2m: number[];
        weather_code: number[];
      };
    };

    const current = wx.current;
    if (!current) throw new Error('Data cuaca kosong');

    const nowHour = new Date().getHours();
    const hourly: Array<{ time: string; temp: number; code: number }> = [];
    if (wx.hourly?.time) {
      for (let i = 0; i < wx.hourly.time.length && hourly.length < 5; i++) {
        const hourNum = Number(wx.hourly.time[i].slice(11, 13));
        if (hourNum >= nowHour && (hourNum - nowHour) % 2 === 0) {
          hourly.push({
            time: wx.hourly.time[i].slice(11, 16),
            temp: Math.round(wx.hourly.temperature_2m[i] ?? current.temperature_2m),
            code: wx.hourly.weather_code[i] ?? current.weather_code,
          });
        }
      }
    }

    const formattedNow = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      city: resolvedCity,
      country,
      temperature: Math.round(current.temperature_2m),
      apparentTemp: Math.round(current.apparent_temperature),
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      condition: describeWmoCode(current.weather_code),
      code: current.weather_code,
      hourly: hourly.length >= 3 ? hourly : FALLBACK_WEATHER.hourly,
      updatedAt: formattedNow,
    };
  } catch {
    return {
      ...FALLBACK_WEATHER,
      city: resolvedCity,
    };
  }
}
