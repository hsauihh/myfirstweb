import os
import uuid
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pypinyin import lazy_pinyin, Style
from snownlp import SnowNLP
from datetime import datetime, timezone
from dotenv import load_dotenv
from storage import init_db, save_record, get_history
from weather import get_weather_for_ip

load_dotenv()

init_db()    

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_credentials=True, 
)

def get_session_id(request: Request, response: Response) -> str:
    sid = request.cookies.get("session_id")      # 先看有没有纸条
    if not sid:                                  # 第一次来，没有——发一张
        sid = uuid.uuid4().hex                    # 一串随机、不重复的 id
        response.set_cookie(
            "session_id", sid,
            httponly=True, samesite="lax",
            max_age=60 * 60 * 24 * 30,            # 记 30 天
        )
    return sid

profile = {
    "heroTitle": "关于我",
    "heroSubtitle": "项目，创意，灵感，心得，我的作品",
    "featuredWork": {
        "kicker": "作品",
        "title": "文字实验室",
        "copy": "拼音和情绪，挖掘中文里的细节",
        "linkLabel": "打开作品",
    },
    "identity": {
        "motto": "已识乾坤大，尤怜草木青",
        "learning": "零到全栈",
    },
}

class AnalyzeRequest(BaseModel):
    text: str

@app.get("/api/profile")
def get_profile():
    return profile

def score_label(score):
    if score >= 0.6:
        return "偏积极"
    elif score <= 0.4:
        return "偏消极"
    else:
        return "中性"
    
@app.post("/api/analyze")
def analyze(req: AnalyzeRequest, request: Request, response: Response):
    sid = get_session_id(request, response)
    text = req.text
    score = round(SnowNLP(text).sentiments, 2)
    result = {
        "text": text,
        "score": score,
        "label": score_label(score),
        "pinyin": " ".join(lazy_pinyin(text, style=Style.TONE)),
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    save_record(sid, result)          # 存的时候盖上这个会话的记号
    return result                     # ← 返回体一个字没变，session_id 只走 cookie

@app.get("/api/history")
def history(request: Request, response: Response, limit: int = 10):
    sid = get_session_id(request, response)
    return get_history(sid, limit)    # 只回这个会话自己的


AMAP_KEY = os.environ.get("AMAP_KEY", "")


@app.get("/api/weather")
def weather(request: Request):
    if not AMAP_KEY:
        raise HTTPException(status_code=503, detail="未配置 AMAP_KEY")
    client_ip = request.client.host if request.client else ""
    result = get_weather_for_ip(client_ip, AMAP_KEY)
    if result is None:
        raise HTTPException(status_code=404, detail="无法定位或获取天气")
    return result