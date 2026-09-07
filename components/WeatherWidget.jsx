"use client";

// 天气卡片：全站右上角常驻。默认显示「城市 + 天气 + 温度」，
// 鼠标悬停或键盘聚焦时展开丰富版（湿度 / 风向风力 / 更新时间）为独立浮层。
// 用模块级缓存：切换路由（客户端导航）时模块变量存活，卡片不消失、不重复请求。
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

// 模块级缓存：同一会话内跨页面共享，避免每次路由切换都重新请求/闪烁
let cachedWeather = null;

function formatTime(iso) {
  const match = /(\d{2}:\d{2})/.exec(iso || "");
  return match ? match[1] : "";
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(cachedWeather);

  useEffect(() => {
    if (cachedWeather) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API}/api/weather`);
        if (!res.ok) return;
        const data = await res.json();
        cachedWeather = data;
        if (!cancelled) setWeather(data);
      } catch {
        // 后端没起来时不渲染，页面照常
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!weather) return null;

  return (
    <div className="weather-card" tabIndex={0} aria-label="当地天气">
      <div className="weather-main">
        <span className="weather-city">{weather.city}</span>
        <span className="weather-cond">{weather.weather}</span>
        <span className="weather-temp">{weather.temperature}°</span>
      </div>
      <div className="weather-detail">
        <span>湿度 {weather.humidity}%</span>
        <span>
          {weather.winddirection}风 {weather.windpower}级
        </span>
        <span>更新 {formatTime(weather.reporttime)}</span>
      </div>
    </div>
  );
}
