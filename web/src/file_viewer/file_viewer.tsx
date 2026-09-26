import { useFileContent } from "../storage/storage_store.js";
import "../styles/file_viewer.css";

export interface FileViewerProps {
  path: string | null;
}

export function FileViewer({ path }: FileViewerProps) {
  const { content, truncated, error } = useFileContent(path);

  if (!path) {
    return <div className="file-viewer empty">Select a file to preview its contents.</div>;
  }

  return (
    <div className="file-viewer">
      <div className="viewer-header" title={path}>
        {path}
        {truncated ? <span className="viewer-note"> · truncated</span> : null}
      </div>
      <div className="viewer-body">
        {error ? (
          <div className="viewer-error">{error}</div>
        ) : (
          <pre className="viewer-code">
            {(content ?? "").split("\n").map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: file lines have no stable id
              <div className="viewer-line" key={`line-${index}`}>
                <span className="viewer-line-number">{index + 1}</span>
                <span className="viewer-line-text">{line || " "}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
