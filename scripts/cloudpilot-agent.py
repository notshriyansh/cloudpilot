
import argparse
import json
import os
import re
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from armoriq_sdk import ArmorIQClient

INTERPRET_URL = "http://127.0.0.1:8787/agent/interpret"
MAX_REQUEST_LENGTH = 2000
MAX_SCRIPT_LENGTH = 100_000


def interpret_request(request_text: str) -> dict:
    token = os.environ.get("CLOUDPILOT_API_TOKEN")
    if not token:
        raise RuntimeError("CLOUDPILOT_API_TOKEN is not configured")

    payload = json.dumps({"request": request_text}).encode("utf-8")
    request = Request(
        INTERPRET_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(
            f"Interpretation endpoint returned HTTP {exc.code}"
        ) from None
    except URLError as exc:
        raise RuntimeError(
            f"Could not reach local CloudPilot: {exc.reason}"
        ) from None

    if result.get("status") != "proposal" or result.get("executed") is not False:
        raise RuntimeError("Unexpected interpretation response")

    proposal = result.get("proposal")
    if not isinstance(proposal, dict):
        raise RuntimeError("Missing action proposal")

    return validate_proposal(proposal)


def validate_proposal(proposal: dict) -> dict:
    action = proposal.get("action")

    if action == "inspect_infrastructure":
        if not isinstance(proposal.get("explanation"), str):
            raise RuntimeError("Inspection proposal is missing its explanation")
        return proposal

    if action != "update_disposable_worker":
        raise RuntimeError(f"Unsupported proposed action: {action!r}")

    explanation = proposal.get("explanation")
    script = proposal.get("script")
    compatibility_date = proposal.get("compatibilityDate")

    if not isinstance(explanation, str) or not explanation.strip():
        raise RuntimeError("Update proposal is missing its explanation")

    if not isinstance(script, str) or not script.strip():
        raise RuntimeError("Update proposal has no Worker script")

    if len(script) > MAX_SCRIPT_LENGTH:
        raise RuntimeError("Proposed Worker script exceeds the size limit")

    if not isinstance(compatibility_date, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}", compatibility_date
    ):
        raise RuntimeError("Invalid compatibility date format")

    try:
        date.fromisoformat(compatibility_date)
    except ValueError:
        raise RuntimeError("Invalid compatibility date") from None

    # Never accept a caller-selected target. CloudPilot chooses it server-side.
    if "workerId" in proposal or "worker_id" in proposal:
        raise RuntimeError("Proposal must not select a Worker ID")

    return proposal


def main():
    parser = argparse.ArgumentParser(
        description="Run a Groq + ArmorIQ + CloudPilot request."
    )
    parser.add_argument(
        "request",
        help="Natural-language infrastructure request",
    )
    args = parser.parse_args()

    if not args.request.strip() or len(args.request) > MAX_REQUEST_LENGTH:
        raise RuntimeError("Request must contain 1–2000 characters")

    proposal = interpret_request(args.request)

    print("\nGROQ PROPOSAL")
    print(json.dumps(proposal, indent=2))

    action = proposal["action"]

    if action == "inspect_infrastructure":
        params = {}
    else:
        print("\nTARGET: CloudPilot's server-configured disposable Worker")
        print("PROPOSED SCRIPT:\n")
        print(proposal["script"])
        print("\nCOMPATIBILITY DATE:", proposal["compatibilityDate"])
        print(
            "\nReview the script carefully. It will be submitted for "
            "ArmorIQ authorization and CloudPilot policy evaluation."
        )
        confirmation = input('Type APPLY to proceed, or anything else to cancel: ')
        if confirmation != "APPLY":
            print("Cancelled. No infrastructure action was invoked.")
            return

        params = {
            "script": proposal["script"],
            "compatibilityDate": proposal["compatibilityDate"],
        }

    plan = {
        "goal": proposal["explanation"],
        "steps": [
            {
                "action": action,
                "mcp": "cloudpilot",
                "params": params,
            }
        ],
    }

    client = ArmorIQClient.from_config("armoriq.yaml")

    try:
        captured_plan = client.capture_plan(
            llm="groq-cloudpilot-agent",
            prompt=args.request,
            plan=plan,
        )
        intent_token = client.get_intent_token(
            captured_plan,
            validity_seconds=300,
        )

        result = client.invoke(
            mcp="cloudpilot",
            action=action,
            intent_token=intent_token,
            params=params,
        )

        print("\nARMORIQ INVOCATION")
        print("Status:", result.status)
        print(json.dumps(result.result, indent=2, default=str))

        if result.status != "success":
            raise RuntimeError("ArmorIQ returned an unsuccessful tool result")

        if isinstance(result.result, dict) and (
            result.result.get("isError") or result.result.get("is_error")
        ):
            raise RuntimeError("CloudPilot MCP reported a tool error")

    finally:
        client.close()


if __name__ == "__main__":
    main()
