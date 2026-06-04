"""Abort a specific active agent run by conversationId."""

from ._logger import create_logger

logger = create_logger("stop")


async def handler(context):
    body = context.request.body or {}
    conversation_id = body.get("conversationId")
    logger.log("conversationId:", conversation_id)

    if not conversation_id:
        logger.error("Missing conversationId")
        return {"status_code": 400, "body": "Missing conversationId"}

    aborted = context.utils.abort_active_run(conversation_id)
    logger.log("abort_active_run result:", {"aborted": aborted})

    return {
        "status": "aborting" if aborted else "idle",
        "conversationId": conversation_id,
        "aborted": aborted,
    }
