# backend/tests/test_weather.py
"""weather 模块的单元测试，mock 掉 requests 以隔离外部网络。"""
from unittest.mock import patch

from weather import fetch_weather, get_weather_for_ip, locate_by_ip

KEY = "test-key"


def _mock_response(payload: dict) -> object:
    """构造带 raise_for_status / json 的假响应对象。"""
    resp = _FakeResponse()
    resp._payload = payload
    return resp


class _FakeResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_locate_by_ip_returns_location():
    resp = _mock_response(
        {
            "status": "1",
            "province": "北京市",
            "city": "北京市",
            "adcode": "110000",
        }
    )
    with patch("weather.requests.get", return_value=resp) as mock_get:
        result = locate_by_ip("61.135.169.125", KEY)

    assert result == {
        "province": "北京市",
        "city": "北京市",
        "adcode": "110000",
    }
    mock_get.assert_called_once()


def test_locate_by_ip_falls_back_to_server_exit_when_ip_unknown():
    empty = _mock_response({"status": "1", "province": [], "city": [], "adcode": []})
    fallback = _mock_response(
        {"status": "1", "province": "天津市", "city": "天津市", "adcode": "120000"}
    )
    with patch("weather.requests.get", side_effect=[empty, fallback]) as mock_get:
        result = locate_by_ip("127.0.0.1", KEY)

    assert result["city"] == "天津市"
    assert mock_get.call_count == 2


def test_locate_by_ip_returns_none_when_both_fail():
    empty = _mock_response({"status": "1", "province": [], "city": [], "adcode": []})
    with patch("weather.requests.get", return_value=empty):
        assert locate_by_ip("127.0.0.1", KEY) is None


def test_fetch_weather_parses_lives():
    resp = _mock_response(
        {
            "status": "1",
            "lives": [
                {
                    "weather": "多云",
                    "temperature": "24",
                    "winddirection": "西北",
                    "windpower": "≤3",
                    "humidity": "59",
                    "reporttime": "2026-09-07 22:35:26",
                }
            ],
        }
    )
    with patch("weather.requests.get", return_value=resp):
        result = fetch_weather("330100", KEY)

    assert result == {
        "weather": "多云",
        "temperature": "24",
        "winddirection": "西北",
        "windpower": "≤3",
        "humidity": "59",
        "reporttime": "2026-09-07 22:35:26",
    }


def test_fetch_weather_returns_none_on_empty_lives():
    resp = _mock_response({"status": "1", "lives": []})
    with patch("weather.requests.get", return_value=resp):
        assert fetch_weather("330100", KEY) is None


def test_get_weather_for_ip_combines_location_and_weather():
    location_resp = _mock_response(
        {
            "status": "1",
            "province": "北京市",
            "city": "北京市",
            "adcode": "110000",
        }
    )
    weather_resp = _mock_response(
        {
            "status": "1",
            "lives": [
                {
                    "weather": "晴",
                    "temperature": "29",
                    "winddirection": "北",
                    "windpower": "1-3",
                    "humidity": "40",
                    "reporttime": "2026-09-07 20:00:00",
                }
            ],
        }
    )
    with patch("weather.requests.get", side_effect=[location_resp, weather_resp]):
        result = get_weather_for_ip("61.135.169.125", KEY)

    assert result == {
        "province": "北京市",
        "city": "北京市",
        "weather": "晴",
        "temperature": "29",
        "winddirection": "北",
        "windpower": "1-3",
        "humidity": "40",
        "reporttime": "2026-09-07 20:00:00",
    }


def test_get_weather_for_ip_returns_none_when_locate_fails():
    empty = _mock_response({"status": "1", "province": [], "city": [], "adcode": []})
    with patch("weather.requests.get", return_value=empty):
        assert get_weather_for_ip("127.0.0.1", KEY) is None
