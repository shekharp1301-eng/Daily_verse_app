import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except Exception:  # pragma: no cover
    LlmChat = None
    UserMessage = None


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is required in environment")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 60 * 24 * 7
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
auth_scheme = HTTPBearer()

app = FastAPI(title="Daily Verse API")
api_router = APIRouter(prefix="/api")


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=120)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: str
    name: str
    email: EmailStr
    default_language: Literal["en", "te"]
    notification_time: str
    theme: Literal["light", "dark"]
    timezone: str
    streak: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class VerseCard(BaseModel):
    id: str
    verse_date: str
    language: Literal["en", "te"]
    verse_text: str
    reference: str
    theme: str
    explanation: str
    message: str
    prayer: str
    image_hint: str
    is_favorite: bool = False


class VerseHistoryItem(BaseModel):
    id: str
    verse_date: str
    language: Literal["en", "te"]
    verse_preview: str
    reference: str
    theme: str


class FavoriteToggleResponse(BaseModel):
    saved: bool


class SettingsUpdate(BaseModel):
    default_language: Optional[Literal["en", "te"]] = None
    notification_time: Optional[str] = None
    theme: Optional[Literal["light", "dark"]] = None
    timezone: Optional[str] = None
    notification_enabled: Optional[bool] = None


class UserSettingsOut(BaseModel):
    default_language: Literal["en", "te"]
    notification_time: str
    theme: Literal["light", "dark"]
    timezone: str
    notification_enabled: bool


class MarkReadingRequest(BaseModel):
    verse_id: str
    verse_date: str


class StreakResponse(BaseModel):
    streak: int


class PushTokenRequest(BaseModel):
    token: str
    platform: Optional[str] = "expo"


class PushResult(BaseModel):
    sent_count: int


class RefreshVerseRequest(BaseModel):
    language: Literal["en", "te"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: str, email: str) -> str:
    expiry = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expiry}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def validate_notification_time(notification_time: str) -> bool:
    return bool(re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", notification_time))


def extract_json_payload(raw_text: str) -> dict:
    if not raw_text:
        return {}
    content = raw_text.strip()
    if content.startswith("```"):
        content = content.replace("```json", "").replace("```", "").strip()
    if content.startswith("{") and content.endswith("}"):
        return json.loads(content)
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        return {}
    return json.loads(match.group(0))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError as error:
        raise HTTPException(status_code=401, detail="Invalid token") from error

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_user_streak(user_id: str) -> int:
    logs = await db.read_logs.find({"user_id": user_id}, {"_id": 0, "verse_date": 1}).sort(
        "verse_date", -1
    ).to_list(366)
    if not logs:
        return 0

    unique_dates = []
    seen = set()
    for log in logs:
        verse_date = log.get("verse_date")
        if verse_date and verse_date not in seen:
            seen.add(verse_date)
            unique_dates.append(verse_date)

    if not unique_dates:
        return 0

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    latest = datetime.fromisoformat(unique_dates[0]).date()
    if latest not in (today, yesterday):
        return 0

    streak = 0
    current = latest
    for item in unique_dates:
        parsed_date = datetime.fromisoformat(item).date()
        if parsed_date == current:
            streak += 1
            current = current - timedelta(days=1)
        elif parsed_date < current:
            break
    return streak


def user_to_profile(user: dict, streak: int) -> UserProfile:
    return UserProfile(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        default_language=user.get("default_language", "en"),
        notification_time=user.get("notification_time", "06:00"),
        theme=user.get("theme", "light"),
        timezone=user.get("timezone", "UTC"),
        streak=streak,
    )


def fallback_bilingual_verse(_: str) -> dict:
    return {
        "reference": "2 Timothy 1:7",
        "image_hint": "sunrise mountains",
        "en": {
            "verse_text": "For God gave us not a spirit of fear, but of power and love and self-control.",
            "theme": "Courage",
            "explanation": "This verse reminds you that fear does not define your day. God equips you with strength and calm clarity.",
            "message": "Replace one fear with one faithful action today.",
            "prayer": "Lord, fill my heart with courage, peace, and disciplined love today.",
        },
        "te": {
            "verse_text": "దేవుడు మనకు భయమునకు కాదు, శక్తి, ప్రేమ, స్వస్థత కల మనస్సు ఇచ్చెను.",
            "theme": "ధైర్యం",
            "explanation": "ఈ వాక్యము నేడు నీ హృదయములో ధైర్యాన్ని నింపుతుంది. భయం కన్నా దేవుని ప్రేమ బలమైనది.",
            "message": "ఈ రోజు ఒక భయాన్ని విశ్వాసంతో మార్చు.",
            "prayer": "ప్రభువా, నా భయాలను తొలగించి నీ శాంతితో నన్ను నింపుము.",
        },
    }


def is_valid_bilingual_payload(payload: dict) -> bool:
    if not payload:
        return False
    top_keys = {"reference", "image_hint", "en", "te"}
    if not top_keys.issubset(set(payload.keys())):
        return False

    child_keys = {"verse_text", "theme", "explanation", "message", "prayer"}
    for language in ("en", "te"):
        item = payload.get(language, {})
        if not isinstance(item, dict):
            return False
        if not child_keys.issubset(set(item.keys())):
            return False
    return True


async def generate_bilingual_verse_with_ai(date_str: str) -> dict:
    if not EMERGENT_LLM_KEY or LlmChat is None or UserMessage is None:
        return fallback_bilingual_verse(date_str)

    system_prompt = (
        "You are a Christian devotional assistant. Return ONLY strict JSON with this schema: "
        "{reference:string,image_hint:string,en:{verse_text,theme,explanation,message,prayer},"
        "te:{verse_text,theme,explanation,message,prayer}}."
    )
    user_prompt = (
        f"Generate one devotional for date {date_str}. English and Telugu must be the SAME scripture meaning and same Bible reference. "
        "Keep explanation <=45 words, message <=20 words, prayer <=24 words for each language. "
        "Use clean Telugu script for te. image_hint should be two words like 'sunrise mountains'."
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"daily-verse-bilingual-{date_str}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=user_prompt))
        parsed = extract_json_payload(response)
        if not is_valid_bilingual_payload(parsed):
            return fallback_bilingual_verse(date_str)
        return parsed
    except Exception:
        return fallback_bilingual_verse(date_str)


def bundle_to_verse_doc(date_str: str, pair_id: str, language: Literal["en", "te"], bundle: dict, created_at: str) -> dict:
    item = bundle[language]
    return {
        "id": str(uuid.uuid4()),
        "verse_pair_id": pair_id,
        "verse_date": date_str,
        "language": language,
        "verse_text": item["verse_text"],
        "reference": bundle["reference"],
        "theme": item["theme"],
        "explanation": item["explanation"],
        "message": item["message"],
        "prayer": item["prayer"],
        "image_hint": bundle["image_hint"],
        "created_at": created_at,
    }


async def create_bilingual_pair(date_str: str) -> dict:
    bundle = await generate_bilingual_verse_with_ai(date_str)
    pair_id = str(uuid.uuid4())
    created_at = utc_now_iso()

    en_doc = bundle_to_verse_doc(date_str, pair_id, "en", bundle, created_at)
    te_doc = bundle_to_verse_doc(date_str, pair_id, "te", bundle, created_at)
    await db.verses.insert_many([en_doc.copy(), te_doc.copy()])
    return {"en": en_doc, "te": te_doc}


async def get_or_generate_verse(date_str: str, language: Literal["en", "te"]) -> dict:
    latest = await db.verses.find_one(
        {"verse_date": date_str},
        {"_id": 0, "verse_pair_id": 1},
        sort=[("created_at", -1)],
    )

    if latest:
        pair_id = latest.get("verse_pair_id")
        if pair_id:
            existing = await db.verses.find_one(
                {"verse_date": date_str, "verse_pair_id": pair_id, "language": language},
                {"_id": 0},
            )
            if existing:
                return existing
        else:
            # legacy non-paired data cleanup for strict bilingual consistency
            await db.verses.delete_many({"verse_date": date_str})

    created = await create_bilingual_pair(date_str)
    return created[language]


async def send_expo_push(tokens: list[str], title: str, body: str, data: dict) -> int:
    clean_tokens = [token for token in tokens if token.startswith("ExponentPushToken[")]
    if not clean_tokens:
        return 0

    payload = {
        "messages": [
            {
                "to": token,
                "title": title,
                "body": body,
                "sound": "default",
                "data": data,
            }
            for token in clean_tokens
        ]
    }

    try:
        response = await asyncio.to_thread(
            requests.post,
            "https://exp.host/--/api/v2/push/send",
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if response.status_code >= 400:
            logging.warning("Expo push failed: %s", response.text)
            return 0
        return len(clean_tokens)
    except Exception:
        return 0


async def notification_dispatch_loop():
    while True:
        try:
            users = await db.users.find(
                {
                    "notification_enabled": True,
                    "push_tokens": {"$exists": True, "$ne": []},
                },
                {"_id": 0},
            ).to_list(1000)
            now_utc = datetime.now(timezone.utc)

            for user in users:
                try:
                    timezone_name = user.get("timezone", "UTC")
                    user_time = now_utc.astimezone(ZoneInfo(timezone_name))
                except Exception:
                    user_time = now_utc

                planned = user.get("notification_time", "06:00")
                if not validate_notification_time(planned):
                    planned = "06:00"

                hour, minute = [int(value) for value in planned.split(":")]
                today_str = user_time.date().isoformat()
                if user.get("last_push_date") == today_str:
                    continue
                if user_time.hour != hour or user_time.minute != minute:
                    continue

                language = user.get("default_language", "en")
                verse = await get_or_generate_verse(today_str, language)
                sent = await send_expo_push(
                    user.get("push_tokens", []),
                    "📖 Today’s Verse is Ready",
                    "God’s word for you today 🙏 Tap to read",
                    {"verseId": verse["id"], "date": today_str},
                )
                if sent > 0:
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"last_push_date": today_str, "updated_at": utc_now_iso()}},
                    )
        except Exception as loop_error:
            logging.warning("Notification loop warning: %s", str(loop_error))

        await asyncio.sleep(60)


@api_router.get("/")
async def root():
    return {"message": "Daily Verse API is running"}


@api_router.post("/auth/signup", response_model=TokenResponse)
async def signup(payload: UserCreate):
    email = payload.email.lower()
    exists = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "default_language": "en",
        "notification_time": "06:00",
        "theme": "light",
        "timezone": "UTC",
        "notification_enabled": True,
        "push_tokens": [],
        "last_push_date": None,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
    }
    await db.users.insert_one(user_doc.copy())

    token = create_access_token(user_doc["id"], user_doc["email"])
    return TokenResponse(access_token=token, user=user_to_profile(user_doc, streak=0))


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user["id"], user["email"])
    streak = await get_user_streak(user["id"])
    return TokenResponse(access_token=token, user=user_to_profile(user, streak=streak))


@api_router.get("/auth/me", response_model=UserProfile)
async def me(current_user: dict = Depends(get_current_user)):
    streak = await get_user_streak(current_user["id"])
    return user_to_profile(current_user, streak)


@api_router.get("/verse/today", response_model=VerseCard)
async def today_verse(language: Literal["en", "te"] = "en", current_user: dict = Depends(get_current_user)):
    date_str = datetime.now(timezone.utc).date().isoformat()
    verse = await get_or_generate_verse(date_str, language)
    favorite = await db.favorites.find_one(
        {"user_id": current_user["id"], "verse_id": verse["id"]}, {"_id": 0, "id": 1}
    )
    verse_with_state = {**verse, "is_favorite": bool(favorite)}
    return VerseCard(**verse_with_state)


@api_router.get("/verse/{verse_id}", response_model=VerseCard)
async def verse_by_id(verse_id: str, current_user: dict = Depends(get_current_user)):
    verse = await db.verses.find_one({"id": verse_id}, {"_id": 0})
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")
    favorite = await db.favorites.find_one(
        {"user_id": current_user["id"], "verse_id": verse_id}, {"_id": 0, "id": 1}
    )
    return VerseCard(**{**verse, "is_favorite": bool(favorite)})


@api_router.post("/verse/refresh", response_model=VerseCard)
async def refresh_verse(payload: RefreshVerseRequest, current_user: dict = Depends(get_current_user)):
    date_str = datetime.now(timezone.utc).date().isoformat()
    pair = await create_bilingual_pair(date_str)
    verse_doc = pair[payload.language]
    return VerseCard(**{**verse_doc, "is_favorite": False})


@api_router.get("/history", response_model=list[VerseHistoryItem])
async def history(
    language: Literal["en", "te"] = "en",
    limit: int = 30,
    _: dict = Depends(get_current_user),
):
    items = await db.verses.find(
        {"language": language},
        {
            "_id": 0,
            "id": 1,
            "verse_date": 1,
            "verse_text": 1,
            "reference": 1,
            "theme": 1,
            "language": 1,
            "created_at": 1,
        },
    ).sort([("verse_date", -1), ("created_at", -1)]).to_list(300)

    response = []
    seen_dates = set()
    for item in items:
        verse_date = item["verse_date"]
        if verse_date in seen_dates:
            continue
        seen_dates.add(verse_date)
        response.append(
            VerseHistoryItem(
                id=item["id"],
                verse_date=verse_date,
                language=item["language"],
                verse_preview=item["verse_text"][:90],
                reference=item["reference"],
                theme=item["theme"],
            )
        )
        if len(response) >= max(1, min(limit, 90)):
            break
    return response


@api_router.get("/favorites", response_model=list[VerseCard])
async def favorites(
    language: Literal["en", "te"] = "en",
    current_user: dict = Depends(get_current_user),
):
    favorite_rows = await db.favorites.find(
        {"user_id": current_user["id"], "language": language}, {"_id": 0, "verse_id": 1}
    ).to_list(500)
    ids = [row["verse_id"] for row in favorite_rows]
    if not ids:
        return []

    verses = await db.verses.find({"id": {"$in": ids}}, {"_id": 0}).sort("verse_date", -1).to_list(500)
    return [VerseCard(**{**verse, "is_favorite": True}) for verse in verses]


@api_router.post("/favorites/{verse_id}", response_model=FavoriteToggleResponse)
async def toggle_favorite(verse_id: str, current_user: dict = Depends(get_current_user)):
    verse = await db.verses.find_one({"id": verse_id}, {"_id": 0})
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")

    existing = await db.favorites.find_one(
        {"user_id": current_user["id"], "verse_id": verse_id}, {"_id": 0, "id": 1}
    )
    if existing:
        await db.favorites.delete_one({"id": existing["id"]})
        return FavoriteToggleResponse(saved=False)

    favorite_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "verse_id": verse_id,
        "language": verse["language"],
        "saved_at": utc_now_iso(),
    }
    await db.favorites.insert_one(favorite_doc.copy())
    return FavoriteToggleResponse(saved=True)


@api_router.post("/readings/mark", response_model=StreakResponse)
async def mark_reading(payload: MarkReadingRequest, current_user: dict = Depends(get_current_user)):
    verse = await db.verses.find_one({"id": payload.verse_id}, {"_id": 0, "id": 1})
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")

    await db.read_logs.update_one(
        {"user_id": current_user["id"], "verse_date": payload.verse_date},
        {
            "$set": {
                "user_id": current_user["id"],
                "verse_date": payload.verse_date,
                "updated_at": utc_now_iso(),
            },
            "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": utc_now_iso()},
        },
        upsert=True,
    )
    streak = await get_user_streak(current_user["id"])
    return StreakResponse(streak=streak)


@api_router.get("/streak", response_model=StreakResponse)
async def get_streak(current_user: dict = Depends(get_current_user)):
    streak = await get_user_streak(current_user["id"])
    return StreakResponse(streak=streak)


@api_router.get("/settings", response_model=UserSettingsOut)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return UserSettingsOut(
        default_language=current_user.get("default_language", "en"),
        notification_time=current_user.get("notification_time", "06:00"),
        theme=current_user.get("theme", "light"),
        timezone=current_user.get("timezone", "UTC"),
        notification_enabled=current_user.get("notification_enabled", True),
    )


@api_router.put("/settings", response_model=UserSettingsOut)
async def update_settings(payload: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    updates = {}
    if payload.default_language:
        updates["default_language"] = payload.default_language
    if payload.theme:
        updates["theme"] = payload.theme
    if payload.notification_enabled is not None:
        updates["notification_enabled"] = payload.notification_enabled
    if payload.notification_time:
        if not validate_notification_time(payload.notification_time):
            raise HTTPException(status_code=400, detail="Time must be HH:MM (24h)")
        updates["notification_time"] = payload.notification_time
    if payload.timezone:
        try:
            ZoneInfo(payload.timezone)
        except Exception as zone_error:
            raise HTTPException(status_code=400, detail="Invalid timezone") from zone_error
        updates["timezone"] = payload.timezone

    if updates:
        updates["updated_at"] = utc_now_iso()
        await db.users.update_one({"id": current_user["id"]}, {"$set": updates})

    latest = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return UserSettingsOut(
        default_language=latest.get("default_language", "en"),
        notification_time=latest.get("notification_time", "06:00"),
        theme=latest.get("theme", "light"),
        timezone=latest.get("timezone", "UTC"),
        notification_enabled=latest.get("notification_enabled", True),
    )


@api_router.post("/push/register", response_model=PushResult)
async def register_push_token(payload: PushTokenRequest, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$addToSet": {"push_tokens": payload.token},
            "$set": {"updated_at": utc_now_iso()},
        },
    )
    return PushResult(sent_count=1)


@api_router.post("/push/send-test", response_model=PushResult)
async def send_test_notification(current_user: dict = Depends(get_current_user)):
    sent = await send_expo_push(
        current_user.get("push_tokens", []),
        "📖 Today’s Verse is Ready",
        "God’s word for you today 🙏 Tap to read",
        {"type": "test"},
    )
    return PushResult(sent_count=sent)


@api_router.post("/push/send-daily", response_model=PushResult)
async def send_daily_notifications(_: dict = Depends(get_current_user)):
    users = await db.users.find(
        {
            "notification_enabled": True,
            "push_tokens": {"$exists": True, "$ne": []},
        },
        {"_id": 0},
    ).to_list(1000)
    total_sent = 0
    date_str = datetime.now(timezone.utc).date().isoformat()

    for user in users:
        verse = await get_or_generate_verse(date_str, user.get("default_language", "en"))
        sent = await send_expo_push(
            user.get("push_tokens", []),
            "📖 Today’s Verse is Ready",
            "God’s word for you today 🙏 Tap to read",
            {"verseId": verse["id"], "date": date_str},
        )
        total_sent += sent

    return PushResult(sent_count=total_sent)


async def ensure_demo_user_exists():
    demo_email = "demo@dailyverse.app"
    existing = await db.users.find_one({"email": demo_email}, {"_id": 0, "id": 1})
    if existing:
        return
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": "Demo User",
        "email": demo_email,
        "password_hash": hash_password("Demo@12345"),
        "default_language": "en",
        "notification_time": "06:00",
        "theme": "light",
        "timezone": "UTC",
        "notification_enabled": True,
        "push_tokens": [],
        "last_push_date": None,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
    }
    await db.users.insert_one(user_doc.copy())


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_tasks():
    await ensure_demo_user_exists()
    app.state.notification_task = asyncio.create_task(notification_dispatch_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    if hasattr(app.state, "notification_task"):
        app.state.notification_task.cancel()
    client.close()
