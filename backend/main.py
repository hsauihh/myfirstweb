import os
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pypinyin import lazy_pinyin, Style
from snownlp import SnowNLP
from datetime import datetime, timezone
from dotenv import load_dotenv
import avatars
from chat_api import router as chat_router
from auth import resolve_owner
from auth_api import router as auth_router
from announcements_api import router as announcements_router
from payments_api import router as payments_router
from rag_api import router as rag_router
from friends_api import router as friends_router
from friends_ws import router as friends_ws_router
from db import init_db
from storage import save_record, get_history, clear_history
from weather import get_weather_for_ip

load_dotenv()

init_db()    

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_credentials=True, 
)

app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(announcements_router)
app.include_router(payments_router)
app.include_router(rag_router)
app.include_router(friends_router)
app.include_router(friends_ws_router)

avatars.ensure_dir()
app.mount("/avatars", StaticFiles(directory=avatars.AVATAR_DIR), name="avatars")

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
    owner = resolve_owner(request, response)
    text = req.text
    score = round(SnowNLP(text).sentiments, 2)
    result = {
        "text": text,
        "score": score,
        "label": score_label(score),
        "pinyin": " ".join(lazy_pinyin(text, style=Style.TONE)),
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    save_record(owner, result)          # 存的时候盖上归属记号
    return result                     # ← 返回体一个字没变，session_id 只走 cookie

@app.get("/api/history")
def history(request: Request, response: Response, limit: int = 10):
    owner = resolve_owner(request, response)
    return get_history(owner, limit)    # 只回这个归属自己的


@app.delete("/api/history")
def clear_history_endpoint(request: Request, response: Response):
    """清空当前归属的全部历史记录，返回被删除的条数。"""
    owner = resolve_owner(request, response)
    return {"cleared": clear_history(owner)}


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