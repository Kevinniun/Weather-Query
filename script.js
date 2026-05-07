const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const weatherResult = document.getElementById('weatherResult');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const suggestions = document.getElementById('suggestions');

let searchTimeout = null;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const cityNameMap = {
    '北京': 'Beijing',
    '上海': 'Shanghai',
    '广州': 'Guangzhou',
    '深圳': 'Shenzhen',
    '杭州': 'Hangzhou',
    '南京': 'Nanjing',
    '成都': 'Chengdu',
    '武汉': 'Wuhan',
    '西安': "Xi'an",
    '重庆': 'Chongqing',
    '天津': 'Tianjin',
    '苏州': 'Suzhou',
    '郑州': 'Zhengzhou',
    '长沙': 'Changsha',
    '青岛': 'Qingdao',
    '沈阳': 'Shenyang',
    '哈尔滨': 'Harbin',
    '济南': 'Jinan',
    '合肥': 'Hefei',
    '长春': 'Changchun',
    '漠河': 'Mohe',
    '福州': 'Fuzhou',
    '厦门': 'Xiamen',
    '南宁': 'Nanning',
    '昆明': 'Kunming',
    '贵阳': 'Guiyang',
    '兰州': 'Lanzhou',
    '太原': 'Taiyuan',
    '石家庄': 'Shijiazhuang',
    '大连': 'Dalian',
    '宁波': 'Ningbo',
    '无锡': 'Wuxi',
    '常州': 'Changzhou',
    '佛山': 'Foshan',
    '东莞': 'Dongguan',
    '中山': 'Zhongshan',
    '珠海': 'Zhuhai'
};

const weatherIconMap = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    48: '🌫️',
    51: '🌧️',
    53: '🌧️',
    55: '🌧️',
    61: '🌧️',
    63: '🌧️',
    65: '🌧️',
    71: '❄️',
    73: '❄️',
    75: '❄️',
    80: '🌦️',
    81: '🌦️',
    82: '🌦️',
    95: '⛈️',
    96: '⛈️',
    99: '⛈️'
};

function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dayOfWeek = dayNames[now.getDay()];
    return `${month}/${day}/${year} ${dayOfWeek}`;
}

function getWeatherIcon(code) {
    return weatherIconMap[code] || '🌡️';
}

function translateCityName(city) {
    return cityNameMap[city] || city;
}

async function getCityCoords(city) {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
        throw new Error('City not found');
    }
    return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude,
        name: data.results[0].name,
        country: data.results[0].country || ''
    };
}

async function fetchCitySuggestions(query) {
    if (query.length < 2) return [];
    
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
    const data = await response.json();
    return data.results || [];
}

function showSuggestions(cities) {
    if (cities.length === 0) {
        hideSuggestions();
        return;
    }
    
    const html = cities.map(city => `
        <div class="suggestion-item" data-city="${city.name}" data-lat="${city.latitude}" data-lon="${city.longitude}" data-country="${city.country || ''}">
            <div class="suggestion-city">${city.name}</div>
            <div class="suggestion-country">${city.admin1 ? city.admin1 + ', ' : ''}${city.country}</div>
        </div>
    `).join('');
    
    suggestions.innerHTML = html;
    suggestions.style.display = 'block';
    
    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            cityInput.value = item.dataset.city;
            hideSuggestions();
            searchWeatherByCoords(
                parseFloat(item.dataset.lat),
                parseFloat(item.dataset.lon),
                item.dataset.city,
                item.dataset.country
            );
        });
    });
}

function hideSuggestions() {
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
}

async function fetchWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,windspeed_10m,surface_pressure,weathercode&current_weather=true&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Unable to fetch weather data');
    }
    return await response.json();
}

function getTodayHighLow(forecastData) {
    const today = new Date().toDateString();
    
    for (let i = 0; i < forecastData.daily.time.length; i++) {
        const date = new Date(forecastData.daily.time[i]).toDateString();
        if (date === today) {
            const dayStart = new Date(forecastData.daily.time[i]);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            
            let minTemp = Infinity;
            let minTempHour = '';
            
            for (let j = 0; j < forecastData.hourly.time.length; j++) {
                const hourDate = new Date(forecastData.hourly.time[j]);
                if (hourDate >= dayStart && hourDate < dayEnd) {
                    if (forecastData.hourly.temperature_2m[j] < minTemp) {
                        minTemp = forecastData.hourly.temperature_2m[j];
                        minTempHour = hourDate.getHours().toString().padStart(2, '0') + ':00';
                    }
                }
            }
            
            return {
                high: Math.round(forecastData.daily.temperature_2m_max[i]),
                low: Math.round(minTemp),
                lowHour: minTempHour
            };
        }
    }
    
    return { high: 0, low: 0, lowHour: '' };
}

function getCurrentWeatherInfo(forecastData, cityName) {
    const current = forecastData.current_weather;
    const currentHourIndex = forecastData.hourly.time.findIndex(t => {
        const hourDate = new Date(t);
        return Math.abs(hourDate.getTime() - new Date().getTime()) < 3600000;
    });
    
    return {
        name: cityName,
        currentTemp: Math.round(current.temperature),
        weatherCode: current.weathercode,
        humidity: currentHourIndex >= 0 ? Math.round(forecastData.hourly.relative_humidity_2m[currentHourIndex]) : null,
        windSpeed: Math.round(current.windspeed),
        pressure: currentHourIndex >= 0 ? Math.round(forecastData.hourly.surface_pressure[currentHourIndex]) : null,
        feelsLike: currentHourIndex >= 0 ? Math.round(forecastData.hourly.apparent_temperature[currentHourIndex]) : null
    };
}

function getNextDay1AMTemp(forecastData) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(1, 0, 0, 0);
    
    let closestTemp = null;
    let closestFeelsLike = null;
    let closestDiff = Infinity;
    
    for (let i = 0; i < forecastData.hourly.time.length; i++) {
        const date = new Date(forecastData.hourly.time[i]);
        const diff = Math.abs(date.getTime() - tomorrow.getTime());
        if (diff < closestDiff) {
            closestDiff = diff;
            closestTemp = Math.round(forecastData.hourly.temperature_2m[i]);
            closestFeelsLike = Math.round(forecastData.hourly.apparent_temperature[i]);
        }
    }
    
    return { temp: closestTemp, feelsLike: closestFeelsLike };
}

function displayWeather(weatherInfo, dayHigh, dayLow, lowHour, country) {
    document.getElementById('cityName').textContent = weatherInfo.name;
    document.getElementById('countryName').textContent = country ? ` ${country}` : '';
    document.getElementById('currentDate').textContent = getCurrentDate();
    document.getElementById('temp').textContent = weatherInfo.currentTemp;
    document.getElementById('weatherIcon').textContent = getWeatherIcon(weatherInfo.weatherCode);
    
    const weatherDesc = getWeatherDescription(weatherInfo.weatherCode);
    document.getElementById('weatherDescription').textContent = weatherDesc;
    
    document.getElementById('highTemp').textContent = dayHigh;
    document.getElementById('lowTemp').innerHTML = `${dayLow}&deg;C (${lowHour})`;
    
    document.getElementById('humidity').textContent = weatherInfo.humidity !== null ? `${weatherInfo.humidity}%` : '-';
    document.getElementById('windSpeed').textContent = `${weatherInfo.windSpeed} km/h`;
    document.getElementById('pressure').textContent = weatherInfo.pressure !== null ? `${weatherInfo.pressure} hPa` : '-';
    document.getElementById('feelsLike').innerHTML = weatherInfo.feelsLike !== null ? `${weatherInfo.feelsLike}&deg;C` : '-';
}

function getWeatherDescription(code) {
    const descMap = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Thunderstorm with heavy hail'
    };
    return descMap[code] || 'Unknown';
}

function displayForecast(forecastData) {
    const container = document.getElementById('forecastContainer');
    container.innerHTML = '';

    const daily = forecastData.daily;
    const hourly = forecastData.hourly;

    for (let i = 1; i <= Math.min(daily.time.length - 1, 6); i++) {
        const date = new Date(daily.time[i]);
        const dayName = dayNames[date.getDay()];
        const high = daily.temperature_2m_max[i];
        const low = daily.temperature_2m_min[i];
        const weatherCode = daily.weathercode[i];
        
        const dayStart = new Date(daily.time[i]);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        let minTemp = Infinity;
        let minTempHour = '';
        
        for (let j = 0; j < hourly.time.length; j++) {
            const hourDate = new Date(hourly.time[j]);
            if (hourDate >= dayStart && hourDate < dayEnd) {
                if (hourly.temperature_2m[j] < minTemp) {
                    minTemp = hourly.temperature_2m[j];
                    minTempHour = hourDate.getHours().toString().padStart(2, '0') + ':00';
                }
            }
        }
        
        const targetTime = new Date(daily.time[i]);
        targetTime.setHours(1, 0, 0, 0);
        
        let closest1AM = null;
        let closestDiff = Infinity;
        
        for (let j = 0; j < hourly.time.length; j++) {
            const hourDate = new Date(hourly.time[j]);
            const diff = Math.abs(hourDate.getTime() - targetTime.getTime());
            if (diff < closestDiff) {
                closestDiff = diff;
                closest1AM = {
                    temp: Math.round(hourly.temperature_2m[j]),
                    feelsLike: Math.round(hourly.apparent_temperature[j])
                };
            }
        }

        const forecastDay = document.createElement('div');
        forecastDay.className = 'forecast-day';
        
        const am1Temp = closest1AM ? `${closest1AM.temp}&deg;C (${closest1AM.feelsLike}&deg;C)` : '-';
        
        forecastDay.innerHTML = `
            <div class="forecast-day-name">${dayName}</div>
            <div class="forecast-icon">${getWeatherIcon(weatherCode)}</div>
            <div class="forecast-high">H: ${Math.round(high)}&deg;C</div>
            <div class="forecast-low">L: ${Math.round(low)}&deg;C (${minTempHour})</div>
            <div class="forecast-1am">1AM: ${am1Temp}</div>
        `;
        
        container.appendChild(forecastDay);
    }
}

function displayHourlyForecast(forecastData) {
    const container = document.getElementById('hourlyForecast');
    container.innerHTML = '';

    const hourly = forecastData.hourly;
    const now = new Date();
    const hoursToShow = 48;
    
    let startIndex = 0;
    for (let i = 0; i < hourly.time.length; i++) {
        const hourDate = new Date(hourly.time[i]);
        if (hourDate >= now) {
            startIndex = i;
            break;
        }
    }
    
    const endIndex = Math.min(startIndex + hoursToShow, hourly.time.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        const date = new Date(hourly.time[i]);
        const timeStr = date.getHours().toString().padStart(2, '0') + ':00';
        const temp = Math.round(hourly.temperature_2m[i]);
        const feelsLike = Math.round(hourly.apparent_temperature[i]);
        const weatherCode = hourly.weathercode ? hourly.weathercode[i] : 0;
        
        const hourlyItem = document.createElement('div');
        hourlyItem.className = 'hourly-item';
        hourlyItem.innerHTML = `
            <div class="hourly-time">${timeStr}</div>
            <div class="hourly-icon">${getWeatherIcon(weatherCode)}</div>
            <div class="hourly-temp">${temp}&deg;C</div>
            <div class="hourly-feels-like">Feels ${feelsLike}&deg;</div>
        `;
        
        container.appendChild(hourlyItem);
    }
}

async function searchWeatherByCoords(lat, lon, cityName, country = '') {
    weatherResult.style.display = 'none';
    errorMessage.style.display = 'none';

    try {
        const forecastData = await fetchWeatherData(lat, lon);
        
        const { high, low, lowHour } = getTodayHighLow(forecastData);
        const weatherInfo = getCurrentWeatherInfo(forecastData, cityName);
        const nextDayData = getNextDay1AMTemp(forecastData);
        
        displayWeather(weatherInfo, high, low, lowHour, country);
        displayHourlyForecast(forecastData);
        displayForecast(forecastData);
        
        if (nextDayData.temp !== null) {
            document.getElementById('nextDayTemp').textContent = nextDayData.temp;
            document.getElementById('nextDayFeelsLike').textContent = nextDayData.feelsLike;
        }
        
        weatherResult.style.display = 'block';
    } catch (error) {
        showError(error.message);
    }
}

async function searchWeather() {
    const city = cityInput.value.trim();
    
    if (!city) {
        showError('Please enter a city name');
        return;
    }

    const englishCity = translateCityName(city);

    weatherResult.style.display = 'none';
    errorMessage.style.display = 'none';

    try {
        const coords = await getCityCoords(englishCity);
        const forecastData = await fetchWeatherData(coords.lat, coords.lon);
        
        const { high, low, lowHour } = getTodayHighLow(forecastData);
        const weatherInfo = getCurrentWeatherInfo(forecastData, coords.name);
        const nextDayData = getNextDay1AMTemp(forecastData);
        
        displayWeather(weatherInfo, high, low, lowHour, coords.country);
        displayHourlyForecast(forecastData);
        displayForecast(forecastData);
        
        if (nextDayData.temp !== null) {
            document.getElementById('nextDayTemp').textContent = nextDayData.temp;
            document.getElementById('nextDayFeelsLike').textContent = nextDayData.feelsLike;
        }
        
        weatherResult.style.display = 'block';
    } catch (error) {
        showError(error.message);
    }
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    weatherResult.style.display = 'none';
}

searchBtn.addEventListener('click', searchWeather);

cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        hideSuggestions();
        searchWeather();
    }
});

cityInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length < 2) {
        hideSuggestions();
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        const cities = await fetchCitySuggestions(query);
        showSuggestions(cities);
    }, 300);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        hideSuggestions();
    }
});

document.querySelectorAll('.city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const city = btn.dataset.city;
        cityInput.value = city;
        hideSuggestions();
        searchWeather();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentDate').textContent = getCurrentDate();
    cityInput.value = 'Shanghai';
    searchWeather();
});
