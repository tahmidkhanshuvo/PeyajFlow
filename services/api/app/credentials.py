import argparse
import getpass
import hmac
import re
import secrets
from datetime import UTC, datetime, timedelta
from hashlib import scrypt, sha256
from threading import BoundedSemaphore
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    StringConstraints,
    field_validator,
)
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Uuid,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import notifications
from app.auth import (
    Input,
    Role,
    SessionToken,
    ShortText,
    audit,
    issue_token,
    member_accounts,
    memberships,
    organizations,
    sessions,
    users,
)
from app.database import DB, database_engine, metadata
from app.notifications import contacts
from app.rate_limits import enforce

router = APIRouter(prefix="/v1/auth", tags=["Identity"])
USERNAME = r"^[a-zA-Z][a-zA-Z0-9_.-]{2,63}$"
PHONE = r"^\+[1-9][0-9]{7,14}$"
DUMMY = f"{'0' * 32}:{'0' * 64}"
KDF_SLOTS = BoundedSemaphore(2)
BANGLA_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
SIGNUP_CONFLICTS = {
    "account_credentials_pkey": "username_taken",
    "users_nid_key": "nid_taken",
    "users_phone_key": "phone_taken",
}
credentials = Table(
    "account_credentials",
    metadata,
    Column("username", String(64), primary_key=True),
    Column("membership_id", ForeignKey("memberships.id"), unique=True, nullable=False),
    Column("password_digest", String(97), nullable=False),
)


class Login(Input):
    model_config = ConfigDict(str_strip_whitespace=False)

    username: Annotated[str, StringConstraints(strip_whitespace=True, pattern=USERNAME)]
    password: Annotated[SecretStr, Field(min_length=1, max_length=256)]


class SignupRequest(Login):
    name: ShortText
    district: ShortText
    password: Annotated[SecretStr, Field(min_length=14, max_length=256)]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=PHONE)]
    nid: Annotated[
        str, StringConstraints(strip_whitespace=True, pattern=r"^[0-9]{10,20}$")
    ]
    role: Role

    @field_validator("phone", "nid", mode="before")
    @classmethod
    def normalize_digits(cls, value: object) -> object:
        return value.translate(BANGLA_DIGITS) if isinstance(value, str) else value


OTP_TTL = timedelta(minutes=5)
OTP_ATTEMPTS = 5
# One-time sign-in codes sent by SMS to an operator-verified phone number.
otp_challenges = Table(
    "otp_challenges",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False, index=True),
    Column("code_digest", String(64), nullable=False),
    Column("attempts", Integer, nullable=False, default=0),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("consumed_at", DateTime(timezone=True)),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    CheckConstraint("attempts >= 0", name="otp_attempts"),
)


class OtpRequest(Input):
    phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=PHONE)]

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_digits(cls, value: object) -> object:
        return value.translate(BANGLA_DIGITS) if isinstance(value, str) else value


class OtpVerify(OtpRequest):
    code: Annotated[
        str, StringConstraints(strip_whitespace=True, pattern=r"^[0-9]{6}$")
    ]

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return value.translate(BANGLA_DIGITS) if isinstance(value, str) else value


class OtpAvailability(BaseModel):
    available: bool


class SignupResponse(BaseModel):
    membership_id: UUID
    message: str


def valid_nid(nid: str) -> bool:
    """Accept only the Bangladesh NID formats: 10 digits (smart card),
    13 digits (older cards) or 17 digits (older cards prefixed with the
    holder's birth year). This checks the format only; whether the number
    belongs to the applicant is still checked by the reviewing agent."""
    if len(nid) in (10, 13):
        return True
    if len(nid) == 17:
        return 1900 <= int(nid[:4]) <= datetime.now(UTC).year
    return False


def derive(password: str, salt: bytes) -> bytes:
    return scrypt(
        password.encode(), salt=salt, n=2**15, r=8, p=3, dklen=32, maxmem=64 * 1024**2
    )


def password_digest(password: str) -> str:
    if not 14 <= len(password) <= 256:
        raise ValueError("Use a passphrase between 14 and 256 characters.")
    salt = secrets.token_bytes(16)
    return f"{salt.hex()}:{derive(password, salt).hex()}"


@router.post("/password", response_model=SessionToken, status_code=201)
def sign_in(body: Login, request: Request, response: Response, db: DB):
    username = body.username.casefold()
    client = request.client.host if request.client else "unknown"
    enforce(db, "sign-in-client", client, limit=100, seconds=300)
    enforce(db, "sign-in-account", username, limit=8, seconds=900)
    row = (
        db.execute(
            select(credentials, users.c.verification_status)
            .select_from(
                credentials.join(
                    member_accounts, credentials.c.membership_id == memberships.c.id
                )
            )
            .where(
                credentials.c.username == username, organizations.c.is_demo.is_(False)
            )
            .with_for_update(read=True, of=(credentials, users))
        )
        .mappings()
        .one_or_none()
    )
    salt, expected = (row["password_digest"] if row else DUMMY).split(":")
    if not KDF_SLOTS.acquire(blocking=False):
        raise HTTPException(429, "rate_limited", headers={"Retry-After": "2"})
    try:
        correct = hmac.compare_digest(
            derive(body.password.get_secret_value(), bytes.fromhex(salt)).hex(),
            expected,
        )
    finally:
        KDF_SLOTS.release()
    if row is None or not correct:
        raise HTTPException(401, "credentials_invalid")
    if row["verification_status"] != "verified":
        raise HTTPException(403, "account_not_verified")
    return issue_token(db, row["membership_id"], response)


@router.post("/signup", response_model=SignupResponse, status_code=201)
def signup(body: SignupRequest, request: Request, db: DB):
    if body.role not in (Role.FARMER, Role.BUYER):
        raise HTTPException(403, "role_forbidden")
    if not valid_nid(body.nid):
        raise HTTPException(422, "nid_invalid")

    client = request.client.host if request.client else "unknown"
    enforce(db, "signup-client", client, limit=20, seconds=300)

    if not KDF_SLOTS.acquire(blocking=False):
        raise HTTPException(429, "rate_limited", headers={"Retry-After": "2"})
    try:
        digest = password_digest(body.password.get_secret_value())
    finally:
        KDF_SLOTS.release()

    member_id, user_id, org_id = uuid4(), uuid4(), uuid4()
    try:
        db.execute(
            insert(users).values(
                id=user_id,
                name=body.name,
                district=body.district,
                language="bn",
                phone=body.phone,
                nid=body.nid,
            )
        )
        db.execute(insert(organizations).values(id=org_id, name=body.name))
        db.execute(
            insert(memberships).values(
                id=member_id, user_id=user_id, organization_id=org_id, role=body.role
            )
        )
        db.execute(
            insert(credentials).values(
                username=body.username.casefold(),
                membership_id=member_id,
                password_digest=digest,
            )
        )
        audit(db, member_id, "user.signed_up", user_id)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        code = SIGNUP_CONFLICTS.get(
            getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        )
        if code is None:
            raise
        raise HTTPException(409, code) from None

    return SignupResponse(
        membership_id=member_id,
        message="Account created. Awaiting agent verification.",
    )


def otp_digest(challenge_id: UUID, code: str) -> str:
    return sha256(f"{challenge_id}:{code}".encode()).hexdigest()


def otp_account(db: Session, phone: str) -> UUID | None:
    """The verified, non-demo account whose operator-verified phone this is."""
    return db.scalar(
        select(credentials.c.membership_id)
        .select_from(
            credentials.join(
                member_accounts, credentials.c.membership_id == memberships.c.id
            ).join(contacts, contacts.c.user_id == users.c.id)
        )
        .where(
            contacts.c.phone_e164 == phone,
            organizations.c.is_demo.is_(False),
            users.c.verification_status == "verified",
        )
    )


def deliver_otp(challenge_id: UUID, phone: str, code: str) -> None:
    """Send the code after the response, so timing does not reveal accounts."""
    provider = notifications.sms_provider()
    status = "failed"
    if provider is not None:
        config, sender = provider
        status, _ = notifications.send_sms(
            config,
            sender,
            phone,
            f"PeyajFlow code {code}. মেয়াদ ৫ মিনিট। কাউকে জানাবেন না।",
            callback=False,
        )
    if status in ("failed", "retry"):
        engine = database_engine()
        if engine is None:
            return
        try:
            with Session(engine) as db, db.begin():
                db.execute(
                    update(otp_challenges)
                    .where(otp_challenges.c.id == challenge_id)
                    .values(consumed_at=func.now())
                )
        finally:
            engine.dispose()


@router.get("/otp", response_model=OtpAvailability)
def otp_availability() -> OtpAvailability:
    return OtpAvailability(available=notifications.sms_provider() is not None)


@router.post("/otp/request", status_code=202)
def request_otp(
    body: OtpRequest, request: Request, background: BackgroundTasks, db: DB
) -> Response:
    """Send a sign-in code. The reply is the same whether or not the number
    belongs to an account."""
    if notifications.sms_provider() is None:
        raise HTTPException(503, "otp_unavailable")
    client = request.client.host if request.client else "unknown"
    enforce(db, "otp-request-client", client, limit=10, seconds=300)
    enforce(db, "otp-request-phone", body.phone, limit=3, seconds=900)
    member = otp_account(db, body.phone)
    if member is not None:
        db.execute(
            update(otp_challenges)
            .where(
                otp_challenges.c.membership_id == member,
                otp_challenges.c.consumed_at.is_(None),
            )
            .values(consumed_at=func.now())
        )
        challenge_id = uuid4()
        code = f"{secrets.randbelow(10**6):06d}"
        db.execute(
            insert(otp_challenges).values(
                id=challenge_id,
                membership_id=member,
                code_digest=otp_digest(challenge_id, code),
                expires_at=datetime.now(UTC) + OTP_TTL,
            )
        )
        audit(db, member, "auth.otp_requested", challenge_id)
        db.commit()
        background.add_task(deliver_otp, challenge_id, body.phone, code)
    return Response(status_code=202)


@router.post("/otp/verify", response_model=SessionToken, status_code=201)
def verify_otp(body: OtpVerify, request: Request, response: Response, db: DB):
    if notifications.sms_provider() is None:
        raise HTTPException(503, "otp_unavailable")
    client = request.client.host if request.client else "unknown"
    enforce(db, "otp-verify-client", client, limit=30, seconds=300)
    enforce(db, "otp-verify-phone", body.phone, limit=10, seconds=900)
    member = otp_account(db, body.phone)
    row = (
        db.execute(
            select(otp_challenges)
            .where(
                otp_challenges.c.membership_id == member,
                otp_challenges.c.consumed_at.is_(None),
                otp_challenges.c.expires_at > func.now(),
            )
            .order_by(otp_challenges.c.created_at.desc())
            .limit(1)
            .with_for_update()
        )
        .mappings()
        .one_or_none()
        if member is not None
        else None
    )
    if row is None or row["attempts"] >= OTP_ATTEMPTS:
        raise HTTPException(401, "otp_invalid")
    if not hmac.compare_digest(row["code_digest"], otp_digest(row["id"], body.code)):
        attempts = row["attempts"] + 1
        db.execute(
            update(otp_challenges)
            .where(otp_challenges.c.id == row["id"])
            .values(
                attempts=attempts,
                consumed_at=func.now() if attempts >= OTP_ATTEMPTS else None,
            )
        )
        audit(db, member, "auth.otp_rejected", row["id"])
        db.commit()
        raise HTTPException(401, "otp_invalid")
    db.execute(
        update(otp_challenges)
        .where(otp_challenges.c.id == row["id"])
        .values(consumed_at=func.now())
    )
    audit(db, member, "auth.otp_signed_in", row["id"])
    return issue_token(db, member, response)


def provision(
    db: Session,
    username: str,
    password: str,
    *,
    role: Role,
    name: str,
    district: str,
    organization: str,
    phone: str | None = None,
) -> None:
    if not re.fullmatch(USERNAME, username) or any(
        not 1 <= len(value.strip()) <= 100 for value in (name, district, organization)
    ):
        raise ValueError(
            "Use a valid account ID, display name, district and organization."
        )
    if phone is not None and not re.fullmatch(PHONE, phone):
        raise ValueError("Use an E.164 phone number.")
    key = username.casefold()
    if db.get_bind() is None or db.scalar(
        select(credentials.c.username).where(credentials.c.username == key)
    ):
        raise ValueError("This account ID already exists.")
    member_id, user_id, org_id = uuid4(), uuid4(), uuid4()
    db.execute(
        insert(users).values(
            id=user_id,
            name=name.strip(),
            district=district.strip(),
            language="bn",
            verified=role in (Role.ADMIN, Role.AGENT),
            verification_status="verified",
        )
    )
    db.execute(
        insert(organizations).values(
            id=org_id, name=organization.strip(), is_demo=False
        )
    )
    db.execute(
        insert(memberships).values(
            id=member_id, user_id=user_id, organization_id=org_id, role=role
        )
    )
    db.execute(
        insert(credentials).values(
            username=key,
            membership_id=member_id,
            password_digest=password_digest(password),
        )
    )
    if phone:
        db.execute(
            insert(contacts).values(
                user_id=user_id, phone_e164=phone, verified_at=datetime.now(UTC)
            )
        )


def rotate(db: Session, username: str, password: str) -> None:
    member_id = db.scalar(
        update(credentials)
        .where(credentials.c.username == username.casefold())
        .values(password_digest=password_digest(password))
        .returning(credentials.c.membership_id)
    )
    if member_id is None:
        raise ValueError("Account ID was not found.")
    db.execute(delete(sessions).where(sessions.c.membership_id == member_id))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Provision or rotate a PeyajFlow account with database operator access."
    )
    parser.add_argument("username")
    parser.add_argument(
        "--role", choices=[role.value for role in Role], default="farmer"
    )
    parser.add_argument("--name")
    parser.add_argument("--district")
    parser.add_argument("--organization")
    parser.add_argument("--prompt-verified-phone", action="store_true")
    parser.add_argument("--replace-password", action="store_true")
    args = parser.parse_args()
    if not args.replace_password and not all(
        (args.name, args.district, args.organization)
    ):
        parser.error("Provisioning requires --name, --district and --organization.")
    password = getpass.getpass("New passphrase: ")
    if password != getpass.getpass("Repeat passphrase: "):
        raise SystemExit("Passphrases did not match.")
    engine = database_engine()
    if engine is None:
        raise SystemExit("Set DATABASE_URL first.")
    try:
        with Session(engine) as db, db.begin():
            if args.replace_password:
                rotate(db, args.username, password)
            else:
                phone = (
                    getpass.getpass("Independently verified phone (E.164): ").strip()
                    if args.prompt_verified_phone
                    else None
                )
                provision(
                    db,
                    args.username,
                    password,
                    role=Role(args.role),
                    name=args.name,
                    district=args.district,
                    organization=args.organization,
                    phone=phone,
                )
        print("Account saved.")
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except IntegrityError:
        raise SystemExit(
            "The account ID or verified contact is already in use."
        ) from None
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
