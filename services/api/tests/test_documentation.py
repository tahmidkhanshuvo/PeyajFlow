import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session
from test_pilot import login
from test_pilot import pilot as pilot

from app.auth import Role
from app.credentials import provision
from app.documentation import settings, versions

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="requires a disposable migrated PostgreSQL",
)

PUBLIC = "/v1/docs/public"
MANAGE = "/v1/docs/admin"


def provision_admin(client, engine):
    username = f"docs-{uuid4().hex}"
    password = "temporary documentation fixture passphrase"
    with Session(engine) as db, db.begin():
        provision(
            db,
            username,
            password,
            role=Role.ADMIN,
            name="Docs operator",
            district="Pabna",
            organization="Docs test organization",
        )
    response = client.post(
        "/v1/auth/password", json={"username": username, "password": password}
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_documentation_publication_controls(pilot):
    client, engine, _ = pilot
    with Session(engine) as db:
        saved = dict(db.execute(select(settings)).mappings().one())
    admin = provision_admin(client, engine)
    try:
        config = client.get(MANAGE, headers=admin).json()
        assert datetime.fromisoformat(config["starts_at"]) == datetime(
            2027, 6, 9, 18, tzinfo=UTC
        )
        assert datetime.fromisoformat(config["ends_at"]) == datetime(
            2027, 6, 14, 18, tzinfo=UTC
        )
        assert client.get(MANAGE).status_code == 401
        assert client.get(MANAGE, headers=login(client, "admin")).status_code == 403
        assert client.get(MANAGE, headers=login(client, "farmer")).status_code == 403
        response = client.put(
            MANAGE + "/visibility",
            headers=admin,
            json={"revision": config["revision"], "mode": "off"},
        )
        assert response.status_code == 200
        config = response.json()
        blocked = client.get(PUBLIC)
        assert (
            blocked.status_code == 403
            and blocked.headers["Cache-Control"] == "no-store"
        )
        assert client.get(PUBLIC + "/openapi").status_code == 403

        def visibility(mode, **window):
            response = client.put(
                MANAGE + "/visibility",
                headers=admin,
                json={"revision": config["revision"], "mode": mode, **window},
            )
            assert response.status_code == 200, response.text
            return response.json()

        config = visibility("public")
        baseline = client.get(PUBLIC).json()
        assert baseline["version"] == 0
        assert set(baseline["statistics"]["cohorts"]) == {"operational", "showcase"}
        assert baseline["features"]["assistant"] == "available"
        assert any(
            operation["path"] == "/v1/lots" for operation in baseline["operations"]
        )
        assert client.get(PUBLIC + "/openapi").json()["paths"]["/v1/lots"]

        document = config["draft"]
        document["title"] = "Private draft headline"
        document["team"] = [
            {
                "name": "Sample Editor",
                "role": "Engineering",
                "email": "editor@example.com",
                "photo": "javascript:alert(1)",
            }
        ]
        response = client.put(
            MANAGE + "/draft",
            headers=admin,
            json={"revision": config["revision"], "document": document},
        )
        assert response.status_code == 422
        document["team"][0]["photo"] = ""
        response = client.put(
            MANAGE + "/draft",
            headers=admin,
            json={"revision": config["revision"], "document": document},
        )
        assert response.status_code == 200
        previous = config["revision"]
        config = response.json()
        assert (
            client.get(PUBLIC).json()["document"]["title"] != "Private draft headline"
        )

        publish = {"revision": config["revision"], "note": "First judging edition"}
        assert (
            client.post(MANAGE + "/publish", headers=admin, json=publish).status_code
            == 422
        )
        publish["confirm_team_public"] = True
        response = client.post(MANAGE + "/publish", headers=admin, json=publish)
        assert response.status_code == 200, response.text
        config = response.json()
        published = client.get(PUBLIC, params={"known_version": 0}).json()
        assert published["document"]["title"] == "Private draft headline"
        assert published["document"]["team"][0]["email"] == "editor@example.com"
        assert published["history"][0]["note"] == publish["note"]
        assert (
            "document"
            not in client.get(
                PUBLIC, params={"known_version": config["version"]}
            ).json()
        )
        assert (
            client.get(MANAGE + f"/versions/{config['version']}", headers=admin).json()
            == document
        )
        assert client.get(MANAGE + f"/versions/{config['version']}").status_code == 401
        assert (
            client.put(
                MANAGE + "/visibility",
                headers=admin,
                json={"revision": previous, "mode": "off"},
            ).status_code
            == 409
        )

        config = visibility("off")
        assert (
            client.get(PUBLIC, params={"known_version": config["version"]}).status_code
            == 403
        )
        now = datetime.now(UTC)
        config = visibility(
            "scheduled",
            starts_at=(now + timedelta(hours=2)).isoformat(),
            duration_hours=2,
        )
        assert not config["public"]
        assert client.get(PUBLIC).status_code == 403
        config = visibility(
            "scheduled",
            starts_at=(now - timedelta(hours=2)).isoformat(),
            ends_at=(now - timedelta(hours=1)).isoformat(),
        )
        assert not config["public"]
        config = visibility("scheduled", duration_hours=1)
        assert config["public"]
        assert client.get(PUBLIC).status_code == 200
        assert datetime.fromisoformat(config["ends_at"]) - datetime.fromisoformat(
            config["starts_at"]
        ) == timedelta(hours=1)
    finally:
        with Session(engine) as db, db.begin():
            db.execute(
                update(settings).where(settings.c.id == saved["id"]).values(**saved)
            )
            db.execute(
                delete(versions).where(versions.c.version > saved["published_version"])
            )
