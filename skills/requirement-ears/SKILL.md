# EARS (Easy Approach to Requirements Syntax)

This skill provides templates and patterns for writing clear, unambiguous requirements for TheOMS.

## Requirement Types

| Type | Template | When to Use |
|------|----------|-------------|
| **Ubiquitous** | The `<system>` shall `<action>`. | For always-active behavior. |
| **Event-driven** | When `<trigger>`, the `<system>` shall `<action>`. | For actions triggered by events (e.g., API calls, webhooks). |
| **State-driven** | While `<state>`, the `<system>` shall `<action>`. | For behavior active during a specific state (e.g., while order is 'pending'). |
| **Conditional** | If `<condition>`, then the `<system>` shall `<action>`. | For logic branching based on data or environment. |
| **Unwanted Behavior** | If `<condition>`, then the `<system>` shall `<response>`. | For error handling and validation (e.g., invalid input). |

## TheOMS Examples

### API & Controller
- **Event-driven**: When a `POST` request is sent to `/api/v1/order/refund`, the system shall validate the `order_id` and `amount`.
- **Unwanted Behavior**: If the refund amount exceeds the original order amount, then the system shall return a `400 Bad Request` with error code `REFUND_EXCEEDS_TOTAL`.

### Business Logic (Service Layer)
- **Conditional**: If the user has a "VIP" membership, then the system shall apply a 10% discount to all purchase items.
- **State-driven**: While an inventory item is marked as "restricted", the system shall prevent it from being added to new purchase orders.

### Security
- **Ubiquitous**: The system shall sanitize all user-provided HTML input using `htmlspecialchars` before database storage.

## Best Practices
1. **Be Specific**: Use exact field names or model names.
2. **Avoid Ambiguity**: Avoid words like "fast", "efficient", or "user-friendly". Use measurable criteria.
3. **Traceability**: Each requirement must have a unique ID (e.g., `REQ-1`).
