export type RandomUser = {
  name: string;
  email: string;
  avatar: string;
  raw: any;
};

export async function fetchRandomUser(signal?: AbortSignal): Promise<RandomUser> {
  // Add cache-busting and force network request
  const url = `https://randomuser.me/api?t=${Date.now()}`;
  const res = await fetch(url, { 
    signal,
    cache: 'no-cache',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
  if (!res.ok) {
    throw new Error(`RandomUser API failed: ${res.status}`);
  }
  const data = await res.json();
  const u = data?.results?.[0];
  if (!u) throw new Error('RandomUser API returned empty results');
  const name = `${u.name?.first ?? ''} ${u.name?.last ?? ''}`.trim();
  const email = u.email ?? '';
  const avatar = u.picture?.large || u.picture?.medium || u.picture?.thumbnail || '';
  return { name, email, avatar, raw: data };
}
