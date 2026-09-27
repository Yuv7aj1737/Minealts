/** Shape of `GET /users/@me` for the `identify` scope (Discord API v10). */
export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string;
  public_flags: number;
};

/** Shape of a successful `POST /oauth2/token` response. */
export type DiscordTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

/** Error body returned by the Discord token endpoint. */
export type DiscordOAuthError = {
  error: string;
  error_description?: string;
};

/**
 * The only scope we request.
 *
 * `identify` returns the user's id, username, global_name and avatar hash and
 * nothing else. We do not request `email`, `guilds`, `connections` or
 * `guilds.join` because the marketplace needs none of them.
 */
export const DISCORD_SCOPES = ["identify"] as const;
