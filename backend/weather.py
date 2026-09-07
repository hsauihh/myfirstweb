# backend/weather.py
"""高德天气：IP 定位 + 实况天气查询。

全部函数以 key 作为显式参数注入，便于单元测试 mock；HTTP 调用集中在私有函数中。
"""
import requests

IP_API = "https://restapi.amap.com/v3/ip"
WEATHER_API = "https://restapi.amap.com/v3/weather/weatherInfo"
TIMEOUT_SECONDS = 10


def _get_ip_location(client_ip: str, key: str) -> dict | None:
    """调用高德 IP 定位；client_ip 为空时不传 ip 参数（定位服务器出口）。"""
    params: dict = {"key": key}
    if client_ip:
        params["ip"] = client_ip
    payload = _request_json(IP_API, params)
    if payload is None or payload.get("status") != "1":
        return None
    city = payload.get("city")
    # 无数据时高德返回空列表 []，有数据时返回字符串
    if not city:
        return None
    return {
        "province": str(payload.get("province", "")),
        "city": str(city),
        "adcode": str(payload.get("adcode", "")),
    }


def locate_by_ip(client_ip: str, key: str) -> dict | None:
    """按客户端 IP 定位到城市；私有/无法定位时回退到服务器出口。"""
    location = _get_ip_location(client_ip, key)
    if location is None:
        location = _get_ip_location("", key)
    return location


def fetch_weather(adcode: str, key: str) -> dict | None:
    """查询指定 adcode 的实况天气（天气现象 + 温度）。"""
    payload = _request_json(
        WEATHER_API, {"key": key, "city": adcode, "extensions": "base"}
    )
    lives = (payload or {}).get("lives") or []
    if not lives:
        return None
    live = lives[0]
    return {
        "weather": live.get("weather", ""),
        "temperature": live.get("temperature", ""),
        "winddirection": live.get("winddirection", ""),
        "windpower": live.get("windpower", ""),
        "humidity": live.get("humidity", ""),
        "reporttime": live.get("reporttime", ""),
    }


def get_weather_for_ip(client_ip: str, key: str) -> dict | None:
    """组合 IP 定位与天气查询，返回统一结构；任一步失败返回 None。"""
    location = locate_by_ip(client_ip, key)
    if location is None:
        return None
    weather = fetch_weather(location["adcode"], key)
    if weather is None:
        return None
    return {
        "province": location["province"],
        "city": location["city"],
        "weather": weather["weather"],
        "temperature": weather["temperature"],
        "winddirection": weather["winddirection"],
        "windpower": weather["windpower"],
        "humidity": weather["humidity"],
        "reporttime": weather["reporttime"],
    }


def _request_json(url: str, params: dict) -> dict | None:
    """发送 GET 并解析 JSON；网络或解析异常统一返回 None。"""
    try:
        resp = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
        resp.raise_for_status()
        return resp.json()
    except (requests.RequestException, ValueError):
        return None
