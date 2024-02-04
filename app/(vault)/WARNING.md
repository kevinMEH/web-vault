# Warning

Common mistakes that could be made:

- Calling trim or refresh will invalidate the existing token, so if you're using the existing token for an operation, a race condition may result with the operation may or may not succeeding, depending on whether or not the token is refreshed or trimmed and invalidated yet.
- Because of this, it is ill advised to save vaultToken in a variable for usage later on. VaultToken should be retrieved from localStorage in the same tick that it is used.

- NOTE: Currently, vault token refresh is disabled. TODO: Find a way to enable but not disrupt functionality as mentioned above.
- Sometimes, race conditions may be inevitable. The vaultToken needs to be refreshed, but before the refresh could occur the user may opt to perform an action, leading to a race condition.
- For this reason, it is not recommended to immediately redirect to /login whenever an operation fails. Instead, the operation should optimally be retried at least once.
- TODO: Perhaps find a better way to refresh token instead of when vault page first loads.