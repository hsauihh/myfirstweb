"""聊天模型层：拼装上下文 + 通过 OpenAI 兼容接口流式生成。

配置以 ChatConfig 显式注入，便于单元测试；客户端在调用时才构造。
"""
from dataclasses import dataclass
from typing import Iterator

from openai import OpenAI

DEFAULT_MAX_TURNS = 20          # 发给模型的最近消息条数
HISTORY_FETCH_LIMIT = 50        # 从库里取历史的上限，给上下文裁剪留余量
DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_SYSTEM_PROMPT = "你是文字实验室的中文助手，回答简洁、友好、口语化。"
RAG_INSTRUCTION = (
    "优先依据下面的「参考资料」回答；资料不足或与问题无关时直说没有相关资料，"
    "不要编造。回答末尾标注来源文件名。\n\n参考资料：\n"
)


@dataclass(frozen=True)
class ChatConfig:
    """一次聊天调用所需的模型配置。"""
    base_url: str
    api_key: str
    model: str
    system_prompt: str


def build_messages(
    system_prompt: str,
    history: list[dict],
    user_text: str,
    *,
    max_turns: int = DEFAULT_MAX_TURNS,
    context: str = "",
) -> list[dict]:
    """拼装请求体：system 在首位，随后是最近 max_turns 条历史，最后是当前用户消息。

    context 非空时作为知识库参考资料追加到 system 提示词。
    """
    if context:
        system_prompt = f"{system_prompt}\n\n{RAG_INSTRUCTION}{context}"
    recent = history[-max_turns:] if max_turns > 0 else history
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": item["role"], "content": item["content"]} for item in recent)
    messages.append({"role": "user", "content": user_text})
    return messages


def stream_reply(messages: list[dict], config: ChatConfig) -> Iterator[str]:
    """流式调用模型，逐段产出文本增量。"""
    client = OpenAI(base_url=config.base_url, api_key=config.api_key)
    stream = client.chat.completions.create(
        model=config.model, messages=messages, stream=True
    )
    for chunk in stream:
        if not chunk.choices:
            continue
        text = getattr(chunk.choices[0].delta, "content", None)
        if text:
            yield text
