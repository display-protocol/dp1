import { useEffect, useState } from 'react';

const API_SECRET = 'secret';

async function sign(key: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(key));
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [curl, setCurl] = useState('');
  const [log, setLog] = useState<{ command: string; response: string }[]>([]);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setApiKey(localStorage.getItem('apiKey') || '');
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    (async () => {
      const sig = await sign(apiKey);
      const res = await fetch('/api/v1/playlists', {
        headers: { 'X-API-Key': apiKey, 'X-Signature': sig }
      });
      const data: any = await res.json();
      setPlaylist(data[0]?.items || []);
    })();
  }, [apiKey]);

  useEffect(() => {
    if (!playlist[index]) return;
    const timer = setTimeout(() => {
      setIndex(i => (i + 1) % playlist.length);
    }, playlist[index].duration * 1000);
    return () => clearTimeout(timer);
  }, [playlist, index]);

  const saveKey = () => {
    localStorage.setItem('apiKey', apiKey);
  };

  const example = () => {
    setCurl('curl -X GET /api/v1/playlists');
  };

  const send = async () => {
    const methodMatch = curl.match(/-X\s+(\w+)/);
    const urlMatch = curl.match(/(\/api\S+)/);
    const bodyMatch = curl.match(/-d\s+'([^']+)'/);
    const headerMatches = [...curl.matchAll(/-H\s+"([^:]+):\s*([^\"]+)"/g)];
    const method = methodMatch ? methodMatch[1] : 'GET';
    const url = urlMatch ? urlMatch[1] : '/';
    const headers: Record<string, string> = {};
    for (const m of headerMatches) headers[m[1]] = m[2];
    const sig = await sign(apiKey);
    headers['X-API-Key'] = apiKey;
    headers['X-Signature'] = sig;
    const res = await fetch(url, { method, headers, body: bodyMatch ? bodyMatch[1] : undefined });
    const text = await res.text();
    setLog(l => [...l, { command: curl, response: text }]);
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2 p-4 border-r">
        <h1 className="text-xl font-bold mb-2">Player Panel</h1>
        {playlist.length > 0 && (
          <iframe
            key={playlist[index].id}
            src={playlist[index].source}
            allow="*"
            className="w-full h-96 border"
          />
        )}
      </div>
      <div className="w-1/2 p-4">
        <h1 className="text-xl font-bold mb-2">Chat Panel</h1>
        <input className="border p-1 mr-2" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API KEY" />
        <button className="bg-blue-500 text-white px-2 py-1 mr-2" onClick={saveKey}>Save</button>
        <button className="bg-gray-300 px-2 py-1 mr-2" onClick={example}>Example</button>
        <div className="mt-2">
          <textarea className="border w-full p-2" rows={4} value={curl} onChange={e => setCurl(e.target.value)} placeholder="curl command" />
          <button className="mt-2 bg-blue-500 text-white px-2 py-1" onClick={send}>Send</button>
        </div>
        <div className="mt-4 h-40 overflow-y-auto border p-2 text-sm">
          {log.map((l, i) => (
            <div key={i} className="mb-2">
              <div className="font-mono text-gray-600">$ {l.command}</div>
              <pre className="whitespace-pre-wrap">{l.response}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
