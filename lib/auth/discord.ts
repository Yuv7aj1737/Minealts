export function discordAvatarUrl(user: { id?: string; avatar?: string; avatarUrl?: string }): string {
  if (user?.avatarUrl) return user.avatarUrl;
  if (user?.id && user?.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  return "";
}
