/**
 * WeatherManager.js
 * Handles weather data fetching and UI updates.
 */
const WeatherManager = {
    /**
     * Mapping of Open-Meteo WMO Weather Codes to Emojis and Descriptions
     */
    getWeatherInfo(code) {
        const mapping = {
            0: { emoji: '☀️', desc: 'Sereno' },
            1: { emoji: '🌤️', desc: 'Prevalentemente sereno' },
            2: { emoji: '⛅', desc: 'Parzialmente nuvoloso' },
            3: { emoji: '☁️', desc: 'Coperto' },
            45: { emoji: '🌫️', desc: 'Nebbia' },
            48: { emoji: '🌫️', desc: 'Nebbia con brina' },
            51: { emoji: '🌦️', desc: 'Pioggerella leggera' },
            53: { emoji: '🌦️', desc: 'Pioggerella moderata' },
            55: { emoji: '🌦️', desc: 'Pioggerella densa' },
            61: { emoji: '🌧️', desc: 'Pioggia leggera' },
            63: { emoji: '🌧️', desc: 'Pioggia moderata' },
            65: { emoji: '🌧️', desc: 'Pioggia forte' },
            71: { emoji: '❄️', desc: 'Neve leggera' },
            73: { emoji: '❄️', desc: 'Neve moderata' },
            75: { emoji: '❄️', desc: 'Neve forte' },
            80: { emoji: '🌧️', desc: 'Rovesci di pioggia leggeri' },
            81: { emoji: '🌧️', desc: 'Rovesci di pioggia moderati' },
            82: { emoji: '🌧️', desc: 'Rovesci di pioggia violenti' },
            95: { emoji: '⛈️', desc: 'Temporale' },
            96: { emoji: '⛈️', desc: 'Temporale con grandine' },
            99: { emoji: '⛈️', desc: 'Temporale forte con grandine' }
        };
        return mapping[code] || { emoji: '🌡️', desc: 'Insolito' };
    },

    /**
     * Fetch weather data using Open-Meteo.
     * @param {number} lat 
     * @param {number} lon 
     * @returns {Promise<Object>}
     */
    async fetchWeather(lat, lon) {
        if (!lat || !lon) return null;

        try {
            console.log(`WeatherManager: Fetching Open-Meteo for ${lat}, ${lon}`);
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Open-Meteo fetch failed');
            const data = await response.json();

            // Format to a more usable internal object
            return {
                current: {
                    temp: data.current.temperature_2m,
                    feels_like: data.current.apparent_temperature,
                    code: data.current.weather_code,
                    wind_speed: data.current.wind_speed_10m
                },
                daily: data.daily.time.map((time, i) => ({
                    date: time,
                    code: data.daily.weather_code[i],
                    tempMax: data.daily.temperature_2m_max[i],
                    tempMin: data.daily.temperature_2m_min[i]
                }))
            };
        } catch (e) {
            console.error('Weather error:', e);
            return null;
        }
    },

    /**
     * Render weather info into a container (Dashboard Widget).
     */
    renderWeather(container, data) {
        if (!container || !data || !data.current) {
            if (container) container.innerHTML = '<div style="opacity:0.3; font-size:12px;">Dati meteo non disponibili</div>';
            return;
        }

        const temp = Math.round(data.current.temp);
        const feels = Math.round(data.current.feels_like);
        const info = this.getWeatherInfo(data.current.code);
        const wind = Math.round(data.current.wind_speed);

        container.innerHTML = `
            <div id="weather-widget-click" style="display:flex; align-items:center; gap:12px; cursor:pointer; width: 100%;">
                <div style="font-size:38px; line-height:1;">${info.emoji}</div>
                <div>
                    <div style="font-size:24px; font-weight:bold; color:#fff;">${temp}°C</div>
                    <div style="font-size:12px; opacity:0.7; color:#fff; text-transform:capitalize;">${info.desc}</div>
                </div>
                <div style="margin-left:auto; text-align:right; font-size:11px; opacity:0.8; color:#fff;">
                    <div>Percepiti: ${feels}°C</div>
                    <div>Vento: ${wind} km/h</div>
                </div>
            </div>
        `;
    },

    /**
     * Render weekly forecast list.
     */
    renderWeeklyForecast(container, data) {
        if (!container || !data || !data.daily) return;

        container.innerHTML = '';

        data.daily.forEach((day, i) => {
            const date = new Date(day.date);
            const dayName = i === 0 ? 'Oggi' : date.toLocaleDateString('it-IT', { weekday: 'long' });
            const info = this.getWeatherInfo(day.code);

            const card = document.createElement('div');
            card.className = 'bike-card';
            card.style.cssText = `
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 16px;
                margin-bottom: 12px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            `;

            card.innerHTML = `
                <div style="font-size:32px; width:45px; text-align:center;">${info.emoji}</div>
                <div style="flex-grow:1;">
                    <div style="font-weight:700; font-size:16px; color:#fff; text-transform:capitalize;">${dayName}</div>
                    <div style="font-size:12px; opacity:0.6; color:#fff;">${info.desc}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:16px; font-weight:700; color:var(--primary);">${Math.round(day.tempMax)}°</div>
                    <div style="font-size:12px; opacity:0.5; color:#fff;">${Math.round(day.tempMin)}°</div>
                </div>
            `;
            container.appendChild(card);
        });
    }
};

export default WeatherManager;
