import { useState } from 'react';

export type LogEntry = { command: string; response: string };

interface ChatProps {
  log: LogEntry[];
  setLog: (l: LogEntry[]) => void;
  onSend: (command: string) => Promise<string>;
}

export default function Chat({ log, setLog, onSend }: ChatProps) {
  const [curl, setCurl] = useState('');

  const example = () => {
    setCurl('curl -X GET /api/v1/playlists');
  };

  const send = async () => {
    const resp = await onSend(curl);
    const text = JSON.stringify(JSON.parse(resp), null, 2);
    setLog([...log, { command: curl, response: text }]);
    setCurl('');
  };

  return (
    <div className="flex flex-col h-full">
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
    </div>
  );
}

