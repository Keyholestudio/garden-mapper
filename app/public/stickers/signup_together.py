"""
Sign up for Together.ai and extract the API key.
Uses browser-use with Playwright (isolated browser, not Brave).
"""
import asyncio, os, sys
from pathlib import Path
from dotenv import load_dotenv
from browser_use import Agent, Browser, BrowserProfile
from browser_use.llm import ChatAnthropic

load_dotenv(Path(r"C:\Users\RG\.openclaw\workspace\projects\parabolic-stocks\observer\.env"))

EMAIL = "k3yh0l35tud10@gmail.com"
PASSWORD = "GardenMapper2026!!"

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    temperature=0.0,
    api_key=os.environ["ANTHROPIC_API_KEY"]
)

browser = Browser(browser_profile=BrowserProfile(headless=False))

task = f"""
Go to https://api.together.ai/signup and sign up for a free account.
Use:
- Email: {EMAIL}
- Password: {PASSWORD}

Steps:
1. Fill in the email field with {EMAIL}
2. Fill in the password field with {PASSWORD}
3. Click the Sign Up / Create Account button
4. If there is a Google sign-in option, skip it and use the email/password form instead
5. After signing up, you may need to verify email — if so, tell me "NEEDS_EMAIL_VERIFICATION"
6. If you land on a dashboard or API keys page, look for the API key
7. Copy the API key and print it as: API_KEY: <the key>
8. If you see any onboarding questions, skip or dismiss them

Be patient with page loads. The goal is to get the API key printed to the console.
"""

async def main():
    agent = Agent(task=task, llm=llm, browser=browser)
    result = await agent.run(max_steps=25)
    print("AGENT RESULT:", result)
    await browser.close()

asyncio.run(main())
