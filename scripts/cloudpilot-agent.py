import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from armoriq_sdk import ArmorIQClient


INTERPRET_URL = "http://127.0.0.1:8787/agent/interpret"


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
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(
            f"Interpretation endpoint returned HTTP {exc.code}"
        ) from None
    except URLError as exc:
        raise RuntimeError(
            f"Could not reach the local CloudPilot endpoint: {exc.reason}"
        ) from None

    if result.get("status") != "proposal" or result.get("executed") is not False:
        raise RuntimeError("Unexpected interpretation response")

    proposal = result.get("proposal")
    if not isinstance(proposal, dict):
        raise RuntimeError("Missing action proposal")

    # This first runner intentionally supports inspection only.
    if proposal.get("action") != "inspect_infrastructure":
        raise RuntimeError(
            "This runner only supports inspect_infrastructure for now"
        )

    return proposal


def main():
    prompt = "Inspect the infrastructure managed by CloudPilot."
    proposal = interpret_request(prompt)

    print("GROQ PROPOSAL")
    print(json.dumps(proposal, indent=2))

    plan = {
        "goal": proposal.get("explanation", prompt),
        "steps": [
            {
                "action": "inspect_infrastructure",
                "mcp": "cloudpilot",
                "params": {},
            }
        ],
    }

    client = ArmorIQClient.from_config("armoriq.yaml")

    try:
        captured_plan = client.capture_plan(
            llm="groq-cloudpilot-agent",
            prompt=prompt,
            plan=plan,
        )
        intent_token = client.get_intent_token(
            captured_plan,
            validity_seconds=300,
        )

        result = client.invoke(
            mcp="cloudpilot",
            action="inspect_infrastructure",
            intent_token=intent_token,
            params={},
        )

        print("\nARMORIQ INVOCATION")
        print("Status:", result.status)
        print(json.dumps(result.result, indent=2, default=str))

        if result.status != "success":
            raise RuntimeError("ArmorIQ returned an unsuccessful tool result")

    finally:
        client.close()


if __name__ == "__main__":
    main()