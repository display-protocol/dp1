interface DocProps {
  html: string;
}

export default function DocumentPanel({ html }: DocProps) {
  return (
    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
