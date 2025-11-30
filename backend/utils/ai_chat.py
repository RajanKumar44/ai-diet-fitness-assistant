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
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",  # <- NEW WORKING MODEL
        messages=formatted,
        temperature=0.5,
        max_tokens=400
    )
    return response.choices[0].message.content

