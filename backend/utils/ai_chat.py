from groq import Groq
import os

# Direct key OR environment variable
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def chat_with_coach(history):
    """
    history = list of dicts like:
    [{"role": "user", "content": "Hello"}]
    """

    # Format conversation
    formatted = []
    for msg in history:
        formatted.append({"role": msg["role"], "content": msg["content"]})

    # Call Groq working model
    # Limit history size (fixes token overflow 413 error)
    safe_history = history[-5:] if len(history) > 5 else history

    response = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=safe_history,
    max_tokens=350
    )

    return response.choices[0].message.content

