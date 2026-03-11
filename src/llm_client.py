"""
LLM client with multi-provider fallback.

Tries Groq first, then falls back to Google GenAI (Gemini) if Groq
returns an error (e.g. 403 Forbidden on Azure).
"""

from typing import List, Dict, Generator
from src.config import GROQ_API_KEY, GROQ_MODEL, GOOGLE_API_KEY, GOOGLE_MODEL


def _call_groq(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def _call_google(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    import google.generativeai as genai

    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel(GOOGLE_MODEL)

    prompt_parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            prompt_parts.append(f"[System Instructions]\n{content}\n")
        else:
            prompt_parts.append(content)

    response = model.generate_content(
        "\n".join(prompt_parts),
        generation_config=genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text


def chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0,
    max_tokens: int = 4096,
) -> str:
    """Generate a chat completion, trying Groq first then Google GenAI."""
    providers = []
    if GROQ_API_KEY:
        providers.append(("Groq", _call_groq))
    if GOOGLE_API_KEY:
        providers.append(("Google", _call_google))

    if not providers:
        raise RuntimeError(
            "No LLM API key configured. Set 'groq_api' or 'google_api' environment variable."
        )

    last_error = None
    for name, call_fn in providers:
        try:
            return call_fn(messages, temperature, max_tokens)
        except Exception as e:
            print(f"LLM provider {name} failed: {e}")
            last_error = e

    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")


def _stream_groq(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> Generator[str, None, None]:
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    stream = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield token


def _stream_google(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> Generator[str, None, None]:
    import google.generativeai as genai

    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel(GOOGLE_MODEL)

    prompt_parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            prompt_parts.append(f"[System Instructions]\n{content}\n")
        else:
            prompt_parts.append(content)

    response = model.generate_content(
        "\n".join(prompt_parts),
        generation_config=genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
        stream=True,
    )
    for chunk in response:
        if chunk.text:
            yield chunk.text


def chat_completion_stream(
    messages: List[Dict[str, str]],
    temperature: float = 0,
    max_tokens: int = 4096,
) -> Generator[str, None, None]:
    """Stream a chat completion, trying Groq first then Google GenAI."""
    providers = []
    if GROQ_API_KEY:
        providers.append(("Groq", _stream_groq))
    if GOOGLE_API_KEY:
        providers.append(("Google", _stream_google))

    if not providers:
        raise RuntimeError(
            "No LLM API key configured. Set 'groq_api' or 'google_api' environment variable."
        )

    last_error = None
    for name, stream_fn in providers:
        try:
            yield from stream_fn(messages, temperature, max_tokens)
            return
        except Exception as e:
            print(f"LLM streaming provider {name} failed: {e}")
            last_error = e

    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")
