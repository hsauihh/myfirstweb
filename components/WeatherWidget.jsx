"use client";

// 天气卡片：全站右上角常驻。更新时机仅两处——
// 1) 首次进入网页（无缓存时）自动获取；2) 主动点击卡片（或键盘 Enter/Space）刷新。
// 更新时间取「本次请求的本地时间」，因此点击刷新后更新时间必然更新。
// 模块级缓存保存天气与更新时间：切换路由（客户端导航）时复用，卡片不消失、不重复请求。
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

// 模块级缓存：同一会话内跨页面共享，切换页面不重新请求，更新时间也不丢失
let cache = { weather: null, updatedAt: null };

function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(cache.weather);
  const [updatedAt, setUpdatedAt] = useState(cache.updatedAt);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/weather`);
      if (!res.ok) return;
      const data = await res.json();
      const now = new Date();
      cache = { weather: data, updatedAt: now };
      setWeather(data);
      setUpdatedAt(now);
    } catch {
      // 后端不可用时保持现状
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次进入（无缓存）时获取
  useEffect(() => {
    if (!cache.weather) refresh();
  }, [refresh]);

  if (!weather) return null;

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      refresh();
    }
  }

  return (
    <div
      className={"weather-card" + (loading ? " is-loading" : "")}
      tabIndex={0}
      aria-label="当地天气"
      title="点击刷新天气"
      onClick={refresh}
      onKeyDown={onKeyDown}
    >
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
        <span>更新 {formatTime(updatedAt)}</span>
      </div>
    </div>
  );
}
