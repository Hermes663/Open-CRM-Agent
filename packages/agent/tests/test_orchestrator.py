from datetime import UTC, datetime, timedelta

from autosales.core.orchestrator import route_deal, should_move_to_lost


def test_new_deal_routes_to_qualifier_after_research_completed() -> None:
    deal = {"id": "deal-1", "stage": "new_deal"}
    activities = [
        {
            "activity_type": "research_completed",
            "status": "completed",
            "created_at": datetime.now(UTC).isoformat(),
        }
    ]

    assert route_deal(deal, activities, pending_followups=[]) == "qualifier"


def test_first_email_routes_to_qualifier_after_customer_reply() -> None:
    deal = {"id": "deal-2", "stage": "first_email"}
    activities = [
        {
            "activity_type": "email_received",
            "created_at": datetime.now(UTC).isoformat(),
        }
    ]

    assert route_deal(deal, activities, pending_followups=[]) == "qualifier"


def test_first_email_routes_to_followup_after_inactivity_window() -> None:
    deal = {"id": "deal-3", "stage": "first_email"}
    activities = [
        {
            "activity_type": "email_sent",
            "created_at": (datetime.now(UTC) - timedelta(days=6)).isoformat(),
        }
    ]

    assert route_deal(deal, activities, pending_followups=[]) == "followup"


def test_follow_up_moves_to_lost_after_max_attempts() -> None:
    deal = {"id": "deal-4", "stage": "follow_up"}
    pending_followups = [{"attempt": 1}, {"attempt": 2}, {"attempt": 3}]

    assert route_deal(deal, activities=[], pending_followups=pending_followups) is None
    assert should_move_to_lost(deal, pending_followups) is True
