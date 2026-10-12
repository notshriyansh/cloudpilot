
from armoriq_sdk import ArmorIQClient


def main():
    client = ArmorIQClient.from_config("armoriq.yaml")

    try:
        allowed_plan = client.capture_plan(
            llm="cloudpilot-smoke-test",
            prompt="Inspect the current CloudPilot infrastructure.",
            plan={
                "goal": "Inspect CloudPilot infrastructure",
                "steps": [
                    {
                        "action": "inspect_infrastructure",
                        "mcp": "cloudpilot",
                        "params": {},
                    }
                ],
            },
        )

        allowed_token = client.get_intent_token(
            allowed_plan,
            validity_seconds=300,
        )

        try:
            result = client.invoke(
                mcp="cloudpilot",
                action="inspect_infrastructure",
                intent_token=allowed_token,
                params={},
            )
            print("ALLOW TEST:", result.status)
        except Exception as exc:
            print("ALLOW TEST FAILED:", type(exc).__name__, str(exc))

        denied_params = {"desiredState": {"resources": []}}

        denied_plan = client.capture_plan(
            llm="cloudpilot-smoke-test",
            prompt="Evaluate a proposed infrastructure change.",
            plan={
                "goal": "Evaluate an infrastructure change",
                "steps": [
                    {
                        "action": "evaluate_infrastructure_change",
                        "mcp": "cloudpilot",
                        "params": denied_params,
                    }
                ],
            },
        )

        denied_token = client.get_intent_token(
            denied_plan,
            validity_seconds=300,
        )

        try:
            result = client.invoke(
                mcp="cloudpilot",
                action="evaluate_infrastructure_change",
                intent_token=denied_token,
                params=denied_params,
            )
            print("DENY TEST UNEXPECTEDLY RETURNED:", result.status)
        except Exception as exc:
            print("DENY TEST:", type(exc).__name__, str(exc))

    finally:
        client.close()


if __name__ == "__main__":
    main()
