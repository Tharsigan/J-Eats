"""Turn database rows (snake_case) into the JSON shapes in lib/types.ts (camelCase)."""
from datetime import date, datetime, timezone


def iso(value) -> str | None:
    """DATETIME columns are stored in UTC; return ISO-8601 with a Z suffix."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _drop_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def user_json(row: dict) -> dict:
    """A users row -> the frontend `User` type. Never includes password_hash."""
    return _drop_none(
        {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "campusId": row.get("campus_id") or row.get("id_number") or row["id"],
            "customerSubRole": row.get("customer_sub_role"),
            "idNumber": row.get("id_number"),
            "verificationStatus": row.get("verification_status"),
            "vendorId": row.get("vendor_id"),
            "status": row.get("status"),
            "phone": row.get("phone"),
            "createdAt": iso(row.get("created_at")),
        }
    )
