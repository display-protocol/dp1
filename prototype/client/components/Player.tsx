import { useEffect, useRef, useState } from 'react';

interface PlayerProps {
  playlist: any[];
}

export default function Player({ playlist }: PlayerProps) {
  const [index, setIndex] = useState(0);
  const itemStartRef = useRef(Date.now());

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
    return () => clearTimeout(timer);
  }, [playlist, index]);

  if (!playlist.length) return <div className="flex-1" />;

  return (
    <iframe
      key={playlist[index].id}
      src={playlist[index].source}
      allow="*"
      className="flex-1 w-full border"
    />
  );
}
