import getpass
import pathlib
import sys

import psycopg


PROJECT_REF = "zqieydimlwxedwnlpkok"
POOLER_REGIONS = (
    "ap-southeast-1",
    "ap-northeast-1",
    "ap-southeast-2",
    "ap-south-1",
    "eu-west-1",
    "us-east-1",
)


def connect(password: str):
    errors = []
    for region in POOLER_REGIONS:
        host = f"aws-0-{region}.pooler.supabase.com"
        try:
            connection = psycopg.connect(
                host=host,
                port=5432,
                dbname="postgres",
                user=f"postgres.{PROJECT_REF}",
                password=password,
                sslmode="require",
                connect_timeout=6,
            )
            return connection, host
        except psycopg.Error as error:
            errors.append(f"{region}: {error.__class__.__name__}")
    raise RuntimeError("Could not connect through Supabase pooler: " + ", ".join(errors))


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/install_admin_tool.py <staff-user-uuid>")
        return 2

    staff_user_id = sys.argv[1]
    password = getpass.getpass("Supabase database password: ")
    sql_path = pathlib.Path(__file__).resolve().parents[1] / "supabase" / "admin-tool.sql"
    sql = sql_path.read_text(encoding="utf-8")

    connection, host = connect(password)
    with connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            cursor.execute(
                """
                insert into public.staff_accounts (user_id, role, display_name)
                values (%s::uuid, 'admin', '主客服')
                on conflict (user_id) do update
                set role = excluded.role, display_name = excluded.display_name
                """,
                (staff_user_id,),
            )
            cursor.execute(
                """
                select count(*), max(auth.users.email)
                from public.staff_accounts
                join auth.users on auth.users.id = public.staff_accounts.user_id
                where public.staff_accounts.user_id = %s::uuid
                """,
                (staff_user_id,),
            )
            configured, staff_email = cursor.fetchone()
            cursor.execute("select count(*) from public.payment_requests where status = 'pending'")
            pending_requests = cursor.fetchone()[0]

    print(f"Admin tool installed through {host}; staff records configured: {configured}")
    if staff_email:
        local, domain = staff_email.split("@", 1)
        masked = f"{local[:2]}***@{domain}"
        print(f"Configured staff email: {masked}")
    print(f"Pending membership requests: {pending_requests}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
