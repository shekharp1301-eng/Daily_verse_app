import os

import pytest
import requests


BASE_URL = os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    pytest.skip("EXPO_BACKEND_URL is required for public endpoint testing", allow_module_level=True)

BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def demo_auth_header(api_client):
    payload = {"email": "demo@dailyverse.app", "password": "Demo@12345"}
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=20)
    if response.status_code != 200:
        pytest.skip(f"Auth login failed: {response.status_code} {response.text}")
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}
