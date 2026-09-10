export function buildTreeInvitationLink(treeId: string) {
  return `https://lineagetree.web.app/join/${encodeURIComponent(treeId)}`;
}

export function parseTreeInvitationIdentifier(input: string) {
  const value = input.trim();
  if (!value.includes('://')) return value;
  const match = /^(?:https:\/\/(?:lineagetree\.web\.app|lineagetree\.firebaseapp\.com)\/join\/|lineagetree:\/\/join\/)([^/?#]+)\/?$/.exec(value);
  if (!match) throw new Error('Use a Lineage Tree invitation link, username, email, or tree ID.');
  const id = decodeURIComponent(match[1]);
  if (!id || id.includes('/')) throw new Error('This invitation link is invalid.');
  return id;
}
