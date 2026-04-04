import uuid
from datetime import datetime, timezone

from conftest import BASE_URL


# Covers auth, verse, favorites, history, settings, streak, and push endpoints.
class TestDailyVerseAPI:
    def test_root_status(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/", timeout=20)
        assert response.status_code == 200
        assert response.json().get("message") == "Daily Verse API is running"

    def test_signup_and_me(self, api_client):
        email = f"test_{uuid.uuid4().hex[:8]}@dailyverse.app"
        signup_payload = {"name": "TEST User", "email": email, "password": "Test@12345"}
        signup_response = api_client.post(f"{BASE_URL}/api/auth/signup", json=signup_payload, timeout=20)
        assert signup_response.status_code == 200

        token = signup_response.json()["access_token"]
        me_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert me_response.status_code == 200
        assert me_response.json()["email"] == email

    def test_login_demo_success(self, api_client):
        payload = {"email": "demo@dailyverse.app", "password": "Demo@12345"}
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=20)
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "demo@dailyverse.app"

    def test_today_verse_bilingual(self, api_client, demo_auth_header):
        en_response = api_client.get(
            f"{BASE_URL}/api/verse/today?language=en", headers=demo_auth_header, timeout=30
        )
        te_response = api_client.get(
            f"{BASE_URL}/api/verse/today?language=te", headers=demo_auth_header, timeout=30
        )
        assert en_response.status_code == 200
        assert te_response.status_code == 200
        assert en_response.json()["language"] == "en"
        assert te_response.json()["language"] == "te"

    def test_refresh_verse_returns_new_card(self, api_client, demo_auth_header):
        before = api_client.get(
            f"{BASE_URL}/api/verse/today?language=en", headers=demo_auth_header, timeout=30
        )
        refresh = api_client.post(
            f"{BASE_URL}/api/verse/refresh",
            headers=demo_auth_header,
            json={"language": "en"},
            timeout=45,
        )
        assert refresh.status_code == 200
        assert refresh.json()["id"] != before.json()["id"]

    def test_favorite_toggle_and_list(self, api_client, demo_auth_header):
        today = api_client.get(
            f"{BASE_URL}/api/verse/today?language=en", headers=demo_auth_header, timeout=30
        ).json()
        verse_id = today["id"]

        save_response = api_client.post(
            f"{BASE_URL}/api/favorites/{verse_id}", headers=demo_auth_header, timeout=20
        )
        assert save_response.status_code == 200
        assert save_response.json()["saved"] is True

        favorites = api_client.get(
            f"{BASE_URL}/api/favorites?language=en", headers=demo_auth_header, timeout=20
        )
        favorite_ids = [row["id"] for row in favorites.json()]
        assert verse_id in favorite_ids

        unsave_response = api_client.post(
            f"{BASE_URL}/api/favorites/{verse_id}", headers=demo_auth_header, timeout=20
        )
        assert unsave_response.status_code == 200
        assert unsave_response.json()["saved"] is False

    def test_history_list_and_open_by_id(self, api_client, demo_auth_header):
        history = api_client.get(
            f"{BASE_URL}/api/history?language=en&limit=30", headers=demo_auth_header, timeout=20
        )
        assert history.status_code == 200
        assert isinstance(history.json(), list)

        if history.json():
            first_id = history.json()[0]["id"]
            verse = api_client.get(f"{BASE_URL}/api/verse/{first_id}", headers=demo_auth_header, timeout=20)
            assert verse.status_code == 200
            assert verse.json()["id"] == first_id

    def test_settings_update_and_persist(self, api_client, demo_auth_header):
        payload = {
            "default_language": "te",
            "theme": "dark",
            "notification_time": "07:30",
            "notification_enabled": True,
            "timezone": "UTC",
        }
        update = api_client.put(f"{BASE_URL}/api/settings", headers=demo_auth_header, json=payload, timeout=20)
        assert update.status_code == 200

        latest = api_client.get(f"{BASE_URL}/api/settings", headers=demo_auth_header, timeout=20)
        latest_json = latest.json()
        assert latest.status_code == 200
        assert latest_json["notification_time"] == "07:30"

    def test_mark_reading_updates_streak(self, api_client, demo_auth_header):
        today = api_client.get(
            f"{BASE_URL}/api/verse/today?language=en", headers=demo_auth_header, timeout=20
        ).json()
        payload = {"verse_id": today["id"], "verse_date": datetime.now(timezone.utc).date().isoformat()}
        mark = api_client.post(f"{BASE_URL}/api/readings/mark", headers=demo_auth_header, json=payload, timeout=20)
        assert mark.status_code == 200

        streak = api_client.get(f"{BASE_URL}/api/streak", headers=demo_auth_header, timeout=20)
        assert streak.status_code == 200
        assert streak.json()["streak"] >= 1

    def test_push_register_and_send_endpoints(self, api_client, demo_auth_header):
        register = api_client.post(
            f"{BASE_URL}/api/push/register",
            headers=demo_auth_header,
            json={"token": "ExponentPushToken[TEST_TOKEN_123]", "platform": "expo"},
            timeout=20,
        )
        assert register.status_code == 200
        assert register.json()["sent_count"] == 1

        send_test = api_client.post(f"{BASE_URL}/api/push/send-test", headers=demo_auth_header, timeout=25)
        assert send_test.status_code == 200

        send_daily = api_client.post(f"{BASE_URL}/api/push/send-daily", headers=demo_auth_header, timeout=25)
        assert send_daily.status_code == 200
