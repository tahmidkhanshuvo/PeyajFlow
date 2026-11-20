from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_pilot import login
from test_pilot import pilot as pilot
from test_pilot import pytestmark as pytestmark

from app.auth import Role, audit_log, memberships, users
from app.credentials import provision

PASSWORD = "  fictional signup passphrase  "


def registration(**fields):
    suffix = uuid4().int % 10**12
    return {
        "name": "Signup fixture",
        "district": "Pabna",
        "username": f"signup-{uuid4().hex}",
        "password": PASSWORD,
        "phone": f"+999{suffix:012d}",
        "nid": f"9{suffix:012d}",
        "role": "farmer",
        **fields,
    }


def password_login(client, entry):
    return client.post(
        "/v1/auth/password",
        json={key: entry[key] for key in ("username", "password")},
    )


def bearer(response):
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def staff(client, engine, role):
    entry = registration()
    with Session(engine) as db, db.begin():
        provision(
            db,
            entry["username"],
            entry["password"],
            role=role,
            name="Reviewer fixture",
            district="Pabna",
            organization="Fixture",
        )
    return bearer(password_login(client, entry))


def test_signup_and_review(pilot):
    client, engine, _ = pilot
    agent = staff(client, engine, Role.AGENT)
    admin = staff(client, engine, Role.ADMIN)
    demo_agent = login(client, "agent")
    demo_admin = login(client, "admin")
    entry = registration()
    bangla = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
    create = "/v1/auth/signup"
    verify = "/v1/auth/verify"
    queue = "/v1/auth/verifications"

    assert client.post(create, json={**entry, "role": "agent"}).status_code == 403
    invalid = client.post(create, json={**entry, "nid": "not-an-id-number"})
    assert invalid.status_code == 422
    assert invalid.json() == {"detail": "invalid_input"}
    # Only real Bangladesh NID formats: 10, 13 or 17 digits, and a 17-digit
    # number begins with a plausible birth year.
    for nid in ("12345678901", "123456789012345678", "18001234567890123"):
        refused = client.post(create, json={**entry, "nid": nid})
        assert refused.json() == {"detail": "nid_invalid"}, nid
    created = client.post(
        create,
        json={
            **entry,
            "phone": entry["phone"].translate(bangla),
            "nid": entry["nid"].translate(bangla),
        },
    )
    assert created.status_code == 201, created.text
    member = created.json()["membership_id"]

    for field in ("username", "phone", "nid"):
        taken = entry[field].upper() if field == "username" else entry[field]
        response = client.post(create, json=registration(**{field: taken}))
        assert response.status_code == 409
        assert response.json()["detail"] == f"{field}_taken"

    pending = password_login(client, entry)
    assert pending.status_code == 403
    assert pending.json()["detail"] == "account_not_verified"
    assert password_login(client, {**entry, "password": "wrong"}).status_code == 401

    assert client.get(queue, headers=demo_agent).status_code == 403
    assert client.get(queue, headers=demo_admin).status_code == 403
    listings = client.get(queue, headers=agent)
    assert entry["nid"] not in listings.text and entry["phone"] not in listings.text
    signup = next(row for row in listings.json() if row["membership_id"] == member)
    user_id = signup["user_id"]
    decision = {"user_id": user_id, "action": "verify"}
    assert client.post(verify, headers=demo_agent, json=decision).status_code == 403
    assert client.post(verify, headers=demo_admin, json=decision).status_code == 403

    with ThreadPoolExecutor(max_workers=2) as pool:

        def review():
            return client.post(verify, headers=agent, json=decision).status_code

        assert list(pool.map(lambda _: review(), range(2))) == [204, 204]
    assert (
        client.post(
            verify, headers=agent, json={**decision, "action": "reject"}
        ).status_code
        == 409
    )
    auth = bearer(password_login(client, entry))
    profile = client.get("/v1/me", headers=auth).json()
    assert profile["verified"] is True
    assert "nid" not in profile and "phone" not in profile
    assert client.post(verify, headers=auth, json=decision).status_code == 403

    with Session(engine) as db:
        record = (
            db.execute(
                select(users)
                .join(memberships, memberships.c.user_id == users.c.id)
                .where(memberships.c.id == member)
            )
            .mappings()
            .one()
        )
        assert (record["nid"], record["phone"]) == (entry["nid"], entry["phone"])
        assert record["verified_at"] is not None
        assert (
            str(record["verified_by"])
            == client.get("/v1/me", headers=agent).json()["membership_id"]
        )
        actions = db.scalars(
            select(audit_log.c.action).where(audit_log.c.resource_id == user_id)
        ).all()
        assert actions.count("user.signed_up") == actions.count("user.verified") == 1

    admin_path = f"/v1/admin/verifications/{member}"
    assert (
        client.put(admin_path, headers=admin, json={"verified": False}).json()[
            "signup_status"
        ]
        == "rejected"
    )
    assert client.get("/v1/me", headers=auth).status_code == 401
    assert password_login(client, entry).json()["detail"] == "account_not_verified"
    assert all(
        row["membership_id"] != member
        for row in client.get("/v1/admin/verifications", headers=admin).json()
    )
    assert (
        client.put(admin_path, headers=admin, json={"verified": True}).json()[
            "signup_status"
        ]
        == "verified"
    )
    bearer(password_login(client, entry))

    buyer = registration(role="buyer")
    created = client.post(create, json=buyer)
    buyer_member = created.json()["membership_id"]
    buyer_signup = next(
        row
        for row in client.get(queue, headers=agent).json()
        if row["membership_id"] == buyer_member
    )
    assert (
        client.post(
            verify,
            headers=agent,
            json={"user_id": buyer_signup["user_id"], "action": "reject"},
        ).status_code
        == 204
    )
    assert password_login(client, buyer).json()["detail"] == "account_not_verified"


def test_concurrent_signup_phone_conflict(pilot):
    client, engine, _ = pilot
    first = registration()
    second = registration(phone=first["phone"])

    def submit(entry):
        return client.post("/v1/auth/signup", json=entry)

    with ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(pool.map(submit, (first, second)))
    assert sorted(reply.status_code for reply in replies) == [201, 409]
    conflict = next(reply for reply in replies if reply.status_code == 409)
    assert conflict.json()["detail"] == "phone_taken"
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(users)
                .where(users.c.nid.in_((first["nid"], second["nid"])))
            )
            == 1
        )
