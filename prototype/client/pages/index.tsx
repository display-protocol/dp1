import { useEffect, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import type { GetStaticProps } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import Player from '../components/Player';
import Chat, { LogEntry } from '../components/Chat';
import DocumentPanel from '../components/Document';
import playlistsData from '../../src/data/playlists.json';
import playlistGroupsData from '../../src/data/playlist-groups.json';
import { verify } from '@noble/ed25519';

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
  const [log, setLog] = useState<LogEntry[]>([]);
  const [playlist, setPlaylist] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setPlaylist(state.playlist || []);
      } catch {}
    }
    const savedChat = localStorage.getItem(CHAT_KEY);
    if (savedChat) {
      try { setLog(JSON.parse(savedChat)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ playlist }));
  }, [playlist]);

  const handleCommand = async (curl: string) => {
    const methodMatch = curl.match(/-X\s+(\w+)/);
    const urlMatch = curl.match(/(\/api\S+)/);
    const bodyMatch = curl.match(/-d\s+'([^']+)'/);
    const method = methodMatch ? methodMatch[1] : 'GET';
    const url = urlMatch ? urlMatch[1] : '/';
    const body = bodyMatch ? bodyMatch[1] : undefined;
    const response = await handleLocalApi(method, url, body);
    let logObj: Record<string, string> = {};
    if (Array.isArray(response)) {
      const items = validateItems(response[0]?.items || []);
      if (items.length > 0) {
        setPlaylist(items);
        logObj = { result: 'ok' };
      } else {
        logObj = { error: 'playlistInvalid' };
      }
    } else if (response.playlist) {
      const items = validateItems(response.playlist);
      if (items.length > 0) {
        setPlaylist(items);
        logObj = { result: 'ok' };
      } else {
        logObj = { error: 'playlistInvalid' };
      }
    } else if (response.error) {
      logObj = { error: response.error };
    } else {
      logObj = { error: 'unsupported' };
    }
    const text = JSON.stringify(logObj, null, 2);
    const updated = [...log, { command: curl, response: text }];
    setLog(updated);
    localStorage.setItem(CHAT_KEY, JSON.stringify(updated));
    return JSON.stringify(logObj);
  };

  return (
    <div className="h-screen">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={33} className="flex flex-col p-4 border-r border-gray-700">
          <h1 className="text-xl font-bold mb-2">Player Panel</h1>
          <Player playlist={playlist} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600" />
        <Panel defaultSize={34} className="flex flex-col p-4 border-r border-gray-700">
          <Chat log={log} setLog={setLog} onSend={handleCommand} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600" />
        <Panel defaultSize={33} className="p-4 overflow-y-auto">
          <h1 className="text-xl font-bold mb-2">Document</h1>
          <DocumentPanel html={docHtml} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

async function verifySignature(obj: any) {
  if (!obj.signature || !obj.pubkey) return false;
  const sigHex = obj.signature.split(':')[1];
  const sig = Uint8Array.from(Buffer.from(sigHex, 'hex'));
  const pub = Uint8Array.from(Buffer.from(obj.pubkey, 'hex'));
  const clone = { ...obj };
  delete clone.signature;
  delete clone.pubkey;
  const enc = new TextEncoder();
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(clone))));
  return verify(sig, hash, pub);
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
        if (await verifySignature(data)) {
          return { playlist: data.items };
        }
        return { error: 'sigInvalid' };
      }
      return { error: 'playlistInvalid' };
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

