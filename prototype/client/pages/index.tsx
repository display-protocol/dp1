import { useEffect, useRef, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import type { GetStaticProps } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import playlistsData from '../../src/data/playlists.json';
import playlistGroupsData from '../../src/data/playlist-groups.json';

type LogEntry = { command: string; response: string };

interface PlayerState {
  playlist: any[];
  index: number;
  itemStartedAt: number;
}

const STATE_KEY = 'dp1_state';
const CHAT_KEY = 'dp1_chat';

function validateItems(items: any[]): any[] {
  return items
    .filter(i => typeof i.source === 'string')
    .map(i => ({
      ...i,
      duration: Number(i.duration) > 0 ? Number(i.duration) : 5
    }));
}

export default function Home({ docHtml }: { docHtml: string }) {
  const [curl, setCurl] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const itemStartRef = useRef(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try {
        const state: PlayerState = JSON.parse(saved);
        setPlaylist(state.playlist || []);
        setIndex(state.index || 0);
        itemStartRef.current = state.itemStartedAt || Date.now();
      } catch {}
    }
    const savedChat = localStorage.getItem(CHAT_KEY);
    if (savedChat) {
      try { setLog(JSON.parse(savedChat)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!playlist[index]) return;
    const item = playlist[index];
    const now = Date.now();
    const elapsed = now - itemStartRef.current;
    const duration = Number(item.duration) > 0 ? Number(item.duration) * 1000 : 5000;
    const remaining = duration - elapsed;
    const timer = setTimeout(() => {
      itemStartRef.current = Date.now();
      setIndex(i => (i + 1) % playlist.length);
    }, remaining > 0 ? remaining : 0);
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ playlist, index, itemStartedAt: itemStartRef.current })
    );
    return () => clearTimeout(timer);
  }, [playlist, index]);

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
    const body = bodyMatch ? bodyMatch[1] : undefined;

    const response = await handleLocalApi(method, url, body);
    let logObj: Record<string, string> = {};
    if (Array.isArray(response)) {
      const items = validateItems(response[0]?.items || []);
      if (items.length > 0) {
        setPlaylist(items);
        setIndex(0);
        itemStartRef.current = Date.now();
        logObj = { result: 'ok' };
      } else {
        logObj = { error: 'invalid_playlist' };
      }
    } else if (response.playlist) {
      const items = validateItems(response.playlist);
      if (items.length > 0) {
        setPlaylist(items);
        setIndex(0);
        itemStartRef.current = Date.now();
        logObj = { result: 'ok' };
      } else {
        logObj = { error: 'invalid_playlist' };
      }
    } else if (response.error) {
      logObj = { error: response.error };
    } else {
      logObj = { error: 'unsupported' };
    }

    const text = JSON.stringify(logObj, null, 2);
    setLog(l => {
      const updated = [...l, { command: curl, response: text }];
      localStorage.setItem(CHAT_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={33} className="flex flex-col p-4 border-r border-gray-700">
          <h1 className="text-xl font-bold mb-2">Player Panel</h1>
          {playlist.length > 0 && (
            <iframe
              key={playlist[index].id}
              src={playlist[index].source}
              allow="*"
              className="flex-1 w-full border"
            />
          )}
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600" />
        <Panel defaultSize={34} className="flex flex-col p-4 border-r border-gray-700">
          <h1 className="text-xl font-bold mb-2">Chat Panel</h1>
          <div className="chat-log flex-1 overflow-y-auto space-y-2 pr-1">
            {log.map((l, i) => (
              <div key={i}>
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-lg font-mono whitespace-pre-wrap max-w-xs">
                    {l.command}
                  </div>
                </div>
                <div className="flex justify-start mt-1">
                  <pre className="bg-gray-700 px-3 py-1 rounded-lg whitespace-pre-wrap max-w-xs">{l.response}</pre>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <button className="bg-gray-700 px-2 py-1 mr-2" onClick={example}>Example</button>
            <textarea className="border w-full p-2 mt-2 text-black" rows={4} value={curl} onChange={e => setCurl(e.target.value)} placeholder="curl command" />
            <button className="mt-2 bg-blue-600 text-white px-2 py-1" onClick={send}>Send</button>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600" />
        <Panel defaultSize={33} className="p-4 overflow-y-auto">
          <h1 className="text-xl font-bold mb-2">Document</h1>
          <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: docHtml }} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

async function handleLocalApi(method: string, url: string, body?: string) {
  if (method === 'GET' && url === '/api/v1/playlists') {
    return playlistsData as any;
  }
  if (method === 'GET' && url.startsWith('/api/v1/playlist-groups/')) {
    const id = url.split('/').pop();
    const group = (playlistGroupsData as any[]).find(g => g.id === id);
    return group || { error: 'not_found' };
  }
  if ((method === 'POST' || method === 'PUT') && url === '/api/v1/playlists') {
    try {
      const data = JSON.parse(body || '{}');
      if (Array.isArray(data.items)) {
        return { playlist: data.items };
      }
      return { error: 'invalid_format' };
    } catch {
      return { error: 'invalid_json' };
    }
  }
  return { error: 'unsupported' };
}

export const getStaticProps: GetStaticProps<{ docHtml: string }> = async () => {
  const docsDir = path.join(process.cwd(), 'docs');
  const file = (await fs.readdir(docsDir)).find(f => f.startsWith('DP')) as string;
  const md = await fs.readFile(path.join(docsDir, file), 'utf8');
  const docHtml = (await marked.parse(md)) as string;
  return { props: { docHtml } };
};

