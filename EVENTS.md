# Fishy Events

Open Admin Controls and choose **Event Manager**. Choose **Create Event** to start the five-step wizard. Use **Ben-Bal Bonanza** in the first step for a repeatable one-win objective. Choose an existing pack on the Rewards step, review the 24-hour schedule, then select **Activate now** or set a future Amsterdam start and select **Schedule event**. A draft has no effect on gameplay.

## Timing and reward delivery

The server treats an event window as inclusive at the start and exclusive at the end. Firestore's creation timestamp on the verified action record is the completion time. Duration is elapsed time. Scheduled date inputs and daily limits use Europe/Amsterdam. The schedule form rejects times skipped in spring and picks the earlier occurrence of ambiguous autumn times.

Normal settlement writes a durable action alongside its ordinary game writes. Each worker run reads at most 20 actions. It checks event eligibility, settles matching events independently, and retries failures with backoff. Each event transaction stores progress, cap usage, an action receipt, and its bonus rewards together. Global limits follow the order in which qualifying reward transactions commit when players act concurrently. They cap rewarded completions, not objective progress. A completion skipped because its daily allowance was used does not carry its reward into the next day.

Pack rewards enter the usual pack inventory. Scheduling or activating creates a private copy of each selected pack definition. Awarded packs use that copy, even if the original pack is edited or removed. The exact pack objective still recognizes the original pack identity. Ordinary Pack Builder resolution still applies to the saved pack's external dependencies, such as live random-card pools and pack rewards inside another pack. Event-level random card rewards use the eligible filenames captured at publication.

## Firestore storage

- fishyEvents holds definitions and window timestamps. Its participants and actions subcollections hold individual progress and idempotency records.
- fishyEventActions is the durable verified-action queue.
- fishyEventStats stores aggregate counts and rewards by type.
- fishyEventReceipts holds delivered reward details and acknowledgment state.
- eventPackSnapshots holds private snapshots opened through the regular pack API.

All documents use the existing server-only Firestore rules. New queries use default single-field indexes and equality-index merging. No data migration is required. Delivery runs while a server instance is up and resumes from the stored queue after restart.
