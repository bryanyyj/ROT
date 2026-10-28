import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Shared rendering for streamed chat and workout reviews; model text never becomes raw HTML. */
export function CoachText({ children }: { children: string }) {
  return <div className="coach-text">
    <Markdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} skipHtml disallowedElements={["img"]} components={{
      h1: ({ children }) => <h3>{children}</h3>,
      h2: ({ children }) => <h3>{children}</h3>,
      h3: ({ children }) => <h4>{children}</h4>,
      table: ({ children }) => <div className="coach-table" tabIndex={0} role="region" aria-label="Training table"><table>{children}</table></div>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    }}>{children}</Markdown>
  </div>;
}
